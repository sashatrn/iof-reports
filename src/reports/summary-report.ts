import { loadConfig, type AppConfig } from "../config";
import { type Participant } from "../io/parse-iof";
import { renderTemplate } from "../render/template-engine";
import {
  buildSummaryStandingGroups,
  type SummaryPointSource,
  type SummarySourceResult,
} from "../scoring/summary";
import { formatDate } from "../utils/date";
import { type AwardsModeOptions, filterAwardPlaces, withAwardsSubtitle } from "./awards-mode";
import { getLeftLogo } from "./report-logos";

export type SummarySource = {
  type: "individual";
  label?: string;
  participants: Participant[];
};

function renderTemplateText(
  template: string | undefined,
  eventDate: Date,
  config: AppConfig,
): string | undefined {
  return template
    ?.replaceAll("{{stage}}", config.reportHeader.stage)
    .replaceAll("{{region_of}}", config.reportHeader.region_of)
    .replaceAll("{{year}}", formatDate(eventDate, "yyyy"));
}

function buildEvent(
  eventDate: Date,
  config: AppConfig,
  options: AwardsModeOptions = {},
) {
  return {
    reportTitle: config.summary.reportTitle,
    event: withAwardsSubtitle({
      title:
        config.reportHeader.title ??
        renderTemplateText(config.summary.title, eventDate, config),
      subtitle: renderTemplateText(config.summary.subtitle, eventDate, config),
      location: config.reportHeader.location,
      date: formatDate(eventDate),
      logo1: getLeftLogo(config, "logo1.png"),
      logo2: config.rightLogo,
    }, options),
    officials: config.officials,
  };
}

function buildSourceResults(participants: Participant[]): SummarySourceResult[] {
  return participants.map((participant) => ({
    className: participant.className,
    name: participant.name,
    organisation: participant.club,
    points: participant.points,
  }));
}

function buildPointSources(
  sources: SummarySource[],
  config: AppConfig,
): SummaryPointSource[] {
  const typeCounts = sources.reduce((counts, source) => {
    counts.set(source.type, (counts.get(source.type) ?? 0) + 1);
    return counts;
  }, new Map<SummarySource["type"], number>());
  const seenCounts = new Map<SummarySource["type"], number>();

  return sources.map((source, index) => {
    const seenCount = (seenCounts.get(source.type) ?? 0) + 1;
    seenCounts.set(source.type, seenCount);

    const baseLabel =
      config.summary.sourceLabels[source.type] ??
      source.type;
    const label = source.label ??
      (typeCounts.get(source.type) === 1 ? baseLabel : `${baseLabel} ${seenCount}`);

    return {
      key: `${source.type}-${index}`,
      label,
      results: buildSourceResults(source.participants),
    };
  });
}

export function buildSummaryStandingGroupsFromSources(
  sources: SummarySource[],
  config: AppConfig = loadConfig(),
) {
  return buildSummaryStandingGroups(buildPointSources(sources, config));
}

export function buildSummaryHtml(
  sources: SummarySource[],
  eventDate: Date,
  options: AwardsModeOptions = {},
): string {
  const config = loadConfig();
  const pointSources = buildPointSources(sources, config);
  const standingGroups = buildSummaryStandingGroups(pointSources)
    .map((group) => ({
      ...group,
      standings: filterAwardPlaces(group.standings, (standing) => standing.place, options),
    }))
    .filter((group) => group.standings.length > 0);

  return renderTemplate("summary-pdf.njk", {
    ...buildEvent(eventDate, config, options),
    sources: pointSources.map((source) => ({
      key: source.key,
      label: source.label,
    })),
    standingGroups,
    summary: config.summary,
  });
}
