import { loadConfig, type AppConfig } from "../config";
import { renderTemplate } from "../render/template-engine";
import {
  buildSummaryTeamStandingGroups,
  type SummaryTeamPointSource,
  type SummaryTeamSourceGroup,
} from "../scoring/summary-team";
import { formatDate } from "../utils/date";
import {
  type AwardsModeOptions,
  filterAwardPlaces,
  withAwardsSubtitle,
} from "./awards-mode";
import { getLeftLogo } from "./report-logos";
import { type SummaryTeamSourceType } from "./summary-team-source";

export type SummaryTeamSource = {
  type: SummaryTeamSourceType;
  label?: string;
  groups: SummaryTeamSourceGroup[];
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
    reportTitle: config.summaryTeam.reportTitle,
    event: withAwardsSubtitle({
      title:
        config.reportHeader.title ??
        renderTemplateText(config.summaryTeam.title, eventDate, config),
      subtitle: renderTemplateText(config.summaryTeam.subtitle, eventDate, config),
      location: config.reportHeader.location,
      date: formatDate(eventDate),
      logo1: getLeftLogo(config, "logo1.png"),
      logo2: config.rightLogo,
    }, options),
    officials: config.officials,
  };
}

function buildPointSources(
  sources: SummaryTeamSource[],
  config: AppConfig,
): SummaryTeamPointSource[] {
  const typeCounts = sources.reduce((counts, source) => {
    counts.set(source.type, (counts.get(source.type) ?? 0) + 1);
    return counts;
  }, new Map<SummaryTeamSourceType, number>());
  const seenCounts = new Map<SummaryTeamSourceType, number>();

  return sources.map((source, index) => {
    const seenCount = (seenCounts.get(source.type) ?? 0) + 1;
    seenCounts.set(source.type, seenCount);

    const baseLabel =
      source.label ??
      config.summaryTeam.sourceLabels[source.type] ??
      source.type;
    const label = typeCounts.get(source.type) === 1 ? baseLabel : `${baseLabel} ${seenCount}`;

    return {
      key: `${source.type}-${index}`,
      label,
      groups: source.groups,
    };
  });
}

export function buildSummaryTeamStandingGroupsFromSources(
  sources: SummaryTeamSource[],
  config: AppConfig = loadConfig(),
) {
  return buildSummaryTeamStandingGroups(
    buildPointSources(sources, config),
    config.summaryTeam.layout,
    config.summaryTeam.groupOrder,
  );
}

export function buildSummaryTeamHtml(
  sources: SummaryTeamSource[],
  eventDate: Date,
  options: AwardsModeOptions = {},
): string {
  const config = loadConfig();
  const pointSources = buildPointSources(sources, config);
  const standingGroups = buildSummaryTeamStandingGroups(
    pointSources,
    config.summaryTeam.layout,
    config.summaryTeam.groupOrder,
  ).map((group) => ({
    ...group,
    standings: filterAwardPlaces(group.standings, (standing) => standing.place, options),
  })).filter((group) => group.standings.length > 0);

  return renderTemplate("summary-team-pdf.njk", {
    ...buildEvent(eventDate, config, options),
    sources: pointSources.map((source) => ({
      key: source.key,
      label: source.label,
    })),
    standingGroups,
    summaryTeam: config.summaryTeam,
  });
}
