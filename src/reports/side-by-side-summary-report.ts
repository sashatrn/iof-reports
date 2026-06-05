import { loadConfig } from "../config";
import { renderTemplate } from "../render/template-engine";
import {
  buildTeamSummaryStandings,
  TeamSummaryStanding,
  TeamSummaryPointSource,
  TeamSummarySourceResult,
} from "../scoring/team-summary";
import { formatDate } from "../utils/date";
import { getLeftLogo, getRightLogo } from "./report-logos";

export type SideBySideSummarySourceType = "individual" | "rogaining" | "relay";

export type SideBySideSummarySource = {
  type: SideBySideSummarySourceType;
  label?: string;
  results: TeamSummarySourceResult[];
};

const SOURCE_LABELS: Record<SideBySideSummarySourceType, string> = {
  individual: "В заданому напрямку",
  rogaining: "По вибору",
  relay: "Естафета",
};

function buildSideBySideEvent(eventDate: Date) {
  const config = loadConfig();

  return {
    reportTitle: "Командний підсумок",
    event: {
      title:
        config.reportHeader.title ??
        `Всеукраїнські змагання<br/>
        "Пліч-о-пліч всеукраїнські шкільні ліги зі спортивного орієнтування"<br/>
        серед учнів закладів загальної середньої освіти "РАЗОМ ПЕРЕМОЖЕМО"`,
      subtitle: `Протокол загальнокомандних результатів змагань зі спортивного орієнтування<br/>
        ${config.reportHeader.stage} Пліч-о-пліч, Всеукраїнських шкільних ліг<br/>
        ${config.reportHeader.region_of}, ${formatDate(eventDate, "yyyy")} р.`,
      location: config.reportHeader.location,
      date: formatDate(eventDate),
      logo1: getLeftLogo(config, "logo1.png"),
      logo2: getRightLogo(config, "logo2.png"),
    },
    officials: config.officials,
  };
}

function buildPointSources(sources: SideBySideSummarySource[]): TeamSummaryPointSource[] {
  const typeCounts = sources.reduce((counts, source) => {
    counts.set(source.type, (counts.get(source.type) ?? 0) + 1);
    return counts;
  }, new Map<SideBySideSummarySourceType, number>());
  const seenCounts = new Map<SideBySideSummarySourceType, number>();

  return sources.map((source, index) => {
    const seenCount = (seenCounts.get(source.type) ?? 0) + 1;
    seenCounts.set(source.type, seenCount);

    const baseLabel = source.label ?? SOURCE_LABELS[source.type];
    const label = typeCounts.get(source.type) === 1 ? baseLabel : `${baseLabel} ${seenCount}`;

    return {
      key: `${source.type}-${index}`,
      label,
      results: source.results,
    };
  });
}

export function buildSideBySideSummaryHtml(
  sources: SideBySideSummarySource[],
  eventDate: Date,
): string {
  const pointSources = buildPointSources(sources);

  return renderTemplate("side-by-side-summary-pdf.njk", {
    ...buildSideBySideEvent(eventDate),
    sources: pointSources.map((source) => ({
      key: source.key,
      label: source.label,
    })),
    standings: buildTeamSummaryStandings(pointSources),
  });
}

export function buildSideBySideSummaryStandings(
  sources: SideBySideSummarySource[],
): TeamSummaryStanding[] {
  return buildTeamSummaryStandings(buildPointSources(sources));
}
