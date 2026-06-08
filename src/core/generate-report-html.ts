import { Logger } from "pino";
import { loadConfig } from "../config";
import { parseCourseData } from "../io/parse-course-data";
import { parseIof } from "../io/parse-iof";
import { parseTeamIof } from "../io/parse-team-iof";
import { parseUofBaza } from "../io/parse-uof-baza";
import {
  buildMilitaryRelayClasses,
  buildMilitaryRelayHtml,
  buildMilitaryTeamHtml,
  buildMilitaryTeamStandingGroups,
} from "../reports/military-report";
import { buildIndividualHtml } from "../reports/individual-report";
import {
  buildRogainingAwardsHtml,
  buildRogainingAwardsDocx,
  buildRogainingDiplomasHtml,
  buildRogainingScoreEntries,
  buildRogainingHtml,
  buildRogainingResultsHtml,
  buildRogainingResultsScoreHtml,
  buildRogainingScoreHtml,
  buildRogainingSplitTeamEntries,
  buildRogainingSplitsHtml,
} from "../reports/rogaining-report";
import {
  buildSideBySideRelayClasses,
  buildSideBySideRelayHtml,
  buildSideBySideRelayTeamResults,
} from "../reports/side-by-side-relay-report";
import {
  buildSideBySideRogainingClasses,
  buildSideBySideRogainingHtml,
  buildSideBySideRogainingTeamResults,
} from "../reports/side-by-side-rogaining-report";
import {
  buildSideBySideSummaryHtml,
  buildSideBySideSummaryStandings,
  type SideBySideSummarySource,
  type SideBySideSummarySourceType,
} from "../reports/side-by-side-summary-report";
import { buildSideBySideTeamHtml } from "../reports/side-by-side-team-report";
import { isPdfVisibleParticipant, isPdfVisibleRelayTeam } from "../reports/pdf-status-filter";
import { buildGenderIndividualTeamResults } from "../reports/individual-gender-team-results";
import { getIndividualScoring } from "../scoring/individual-scoring";
import { applyMilitaryIndividualPoints } from "../scoring/military-individual-points";
import { pointsFromPosition } from "../scoring/side-by-side-points";
import { computeTeamResults } from "../scoring/side-by-side-team";
import { ReportType, SingleReportType } from "../report-types";

export type GeneratedReport = {
  reportType: SingleReportType;
  viewHtml: string;
  pdfHtml: string;
  supportsView?: boolean;
  docx?: Buffer;
  eventName?: string;
  eventDate?: string;
  itemCount: number;
};

type GenerateReportOptions = {
  logger?: Logger;
  includeDiplomaBackground?: boolean;
  courseDataXml?: string;
  bazaXml?: string | Buffer;
  relayXml?: string;
  rogainingXml?: string;
  sideBySideSeriesXmls?: Array<{
    type: SideBySideSummarySourceType;
    xml: string;
  }>;
};

function normalizeEventDate(eventDate: Date | undefined, logger?: Logger): Date {
  if (eventDate) {
    return eventDate;
  }

  logger?.warn("Event date not found in IOF XML. Defaulting to current date.");
  return new Date();
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

type PointsCalculator = (position: number | undefined, status: string) => number;

function parseParticipantsXml(
  xml: string,
  logger?: Logger,
  pointsCalculator: PointsCalculator = pointsFromPosition,
  allowEmpty = false,
) {
  const parsed = parseIof(xml);
  const eventDate = normalizeEventDate(parsed.eventDate, logger);

  if (parsed.participants.length === 0 && !allowEmpty) {
    throw new Error(
      "No individual athlete results found in IOF XML. If this is a rogaining TeamResult export, use reportType=rogaining.",
    );
  }

  logger?.info(
    { count: parsed.participants.length },
    "Participants parsed successfully",
  );

  for (const participant of parsed.participants) {
    participant.points = pointsCalculator(participant.position, participant.status);
  }

  return {
    participants: parsed.participants,
    eventDate,
  };
}

function parseTeamResultsXml(xml: string, logger?: Logger, allowEmpty = false) {
  const parsed = parseTeamIof(xml);
  const eventDate = normalizeEventDate(parsed.eventDate, logger);

  if (parsed.teams.length === 0 && !allowEmpty) {
    throw new Error("No team results found in IOF XML.");
  }

  logger?.info(
    { count: parsed.teams.length },
    "Team results parsed successfully",
  );

  return {
    teams: parsed.teams,
    eventDate,
    eventName: parsed.eventName,
  };
}

export function generateIndividualReportHtml(
  xml: string,
  options: GenerateReportOptions = {},
): GeneratedReport {
  const { logger } = options;
  const { participants, eventDate } = parseParticipantsXml(
    xml,
    logger,
    () => 0,
    true,
  );
  const config = loadConfig();
  const scoring = getIndividualScoring(config.individual.scoring);

  scoring.applyPoints(participants, config);

  const pdfParticipants = participants.filter(isPdfVisibleParticipant);
  const teamResults = config.individual.teamResults === "gender" && pdfParticipants.length > 0
    ? buildGenderIndividualTeamResults(pdfParticipants, config, logger)
    : undefined;

  return {
    reportType: "individual",
    viewHtml: buildIndividualHtml(participants, eventDate, "view"),
    pdfHtml: buildIndividualHtml(participants, eventDate, "pdf", teamResults),
    eventDate: toIsoDate(eventDate),
    itemCount: participants.length,
  };
}

export function generateSideBySideTeamReportHtml(
  xml: string,
  options: GenerateReportOptions = {},
): GeneratedReport {
  const { logger } = options;
  const { participants, eventDate } = parseParticipantsXml(xml, logger);
  const config = loadConfig();
  const viewTeamResults = computeTeamResults(participants, config, logger);
  const pdfTeamResults = computeTeamResults(
    participants.filter(isPdfVisibleParticipant),
    config,
    logger,
  );

  return {
    reportType: "team",
    viewHtml: buildSideBySideTeamHtml(viewTeamResults, eventDate, "view"),
    pdfHtml: buildSideBySideTeamHtml(pdfTeamResults, eventDate, "pdf"),
    eventDate: toIsoDate(eventDate),
    itemCount: pdfTeamResults.men.length + pdfTeamResults.women.length,
  };
}

export function generateSideBySideRogainingReportHtml(
  xml: string,
  options: GenerateReportOptions = {},
): GeneratedReport {
  const { logger } = options;
  const { participants, eventDate } = parseParticipantsXml(
    xml,
    logger,
    pointsFromPosition,
    true,
  );

  return {
    reportType: "side-by-side-rogaining",
    viewHtml: buildSideBySideRogainingHtml(participants, eventDate, "view"),
    pdfHtml: buildSideBySideRogainingHtml(participants, eventDate, "pdf"),
    eventDate: toIsoDate(eventDate),
    itemCount: participants.length,
  };
}

export function generateSideBySideRelayReportHtml(
  xml: string,
  options: GenerateReportOptions = {},
): GeneratedReport {
  const { logger } = options;
  const { teams, eventDate, eventName } = parseTeamResultsXml(xml, logger, true);

  return {
    reportType: "side-by-side-relay",
    viewHtml: buildSideBySideRelayHtml(teams, eventDate, "view"),
    pdfHtml: buildSideBySideRelayHtml(teams, eventDate, "pdf"),
    eventName,
    eventDate: toIsoDate(eventDate),
    itemCount: buildSideBySideRelayClasses(teams).flatMap((classGroup) => classGroup.teams).length,
  };
}

function mergeTeamResultPoints(
  results: Array<{ organisation?: string; club?: string; points: number }>,
): Array<{ organisation: string; points: number }> {
  const pointsByOrganisation = new Map<string, number>();

  for (const result of results) {
    const organisation =
      (result.organisation ?? result.club ?? "Unknown").trim() || "Unknown";
    pointsByOrganisation.set(
      organisation,
      (pointsByOrganisation.get(organisation) ?? 0) + result.points,
    );
  }

  return [...pointsByOrganisation.entries()].map(([organisation, points]) => ({
    organisation,
    points,
  }));
}

function buildSideBySideSummarySourceFromXml(
  input: {
    type: SideBySideSummarySourceType;
    xml: string;
  },
  logger?: Logger,
): {
  source: SideBySideSummarySource;
  eventDate: Date;
  eventName?: string;
} {
  const config = loadConfig();

  if (input.type === "relay") {
    const { teams, eventDate, eventName } = parseTeamResultsXml(input.xml, logger, true);
    const classes = buildSideBySideRelayClasses(teams.filter(isPdfVisibleRelayTeam));

    return {
      source: {
        type: input.type,
        results: buildSideBySideRelayTeamResults(classes),
      },
      eventDate,
      eventName,
    };
  }

  const { participants, eventDate } = parseParticipantsXml(
    input.xml,
    logger,
    pointsFromPosition,
    true,
  );
  const pdfParticipants = participants.filter(isPdfVisibleParticipant);

  if (input.type === "rogaining") {
    const classes = buildSideBySideRogainingClasses(pdfParticipants);

    return {
      source: {
        type: input.type,
        results: buildSideBySideRogainingTeamResults(classes),
      },
      eventDate,
    };
  }

  const teamResults = pdfParticipants.length > 0
    ? computeTeamResults(pdfParticipants, config, logger)
    : { men: [], women: [] };

  return {
    source: {
      type: input.type,
      results: mergeTeamResultPoints([
        ...teamResults.men.map((result) => ({
          organisation: result.club,
          points: result.points,
        })),
        ...teamResults.women.map((result) => ({
          organisation: result.club,
          points: result.points,
        })),
      ]),
    },
    eventDate,
  };
}

export function generateSideBySideSummaryReportHtml(
  xml: string,
  options: GenerateReportOptions = {},
): GeneratedReport {
  const { logger } = options;
  const inputs = options.sideBySideSeriesXmls?.length
    ? options.sideBySideSeriesXmls
    : [
        { type: "individual" as const, xml },
        ...(options.rogainingXml
          ? [{ type: "rogaining" as const, xml: options.rogainingXml }]
          : []),
        ...(options.relayXml
          ? [{ type: "relay" as const, xml: options.relayXml }]
          : []),
      ];

  if (inputs.length === 0) {
    throw new Error("side-by-side-summary report requires at least one source XML file.");
  }

  const parsedSources = inputs.map((input) => buildSideBySideSummarySourceFromXml(input, logger));
  const eventDate = parsedSources[0].eventDate;
  const eventName = parsedSources.find((parsedSource) => parsedSource.eventName)?.eventName;
  const sources = parsedSources.map((parsedSource) => parsedSource.source);
  const standings = buildSideBySideSummaryStandings(sources);
  const html = buildSideBySideSummaryHtml(sources, eventDate);

  return {
    reportType: "side-by-side-summary",
    viewHtml: html,
    pdfHtml: html,
    supportsView: false,
    eventName,
    eventDate: toIsoDate(eventDate),
    itemCount: standings.length,
  };
}

export function generateMilitaryRelayReportHtml(
  xml: string,
  options: GenerateReportOptions = {},
): GeneratedReport {
  const { logger } = options;
  const config = loadConfig();
  const { teams, eventDate, eventName } = parseTeamResultsXml(xml, logger, true);

  return {
    reportType: "military-relay",
    viewHtml: buildMilitaryRelayHtml(teams, eventDate, "view"),
    pdfHtml: buildMilitaryRelayHtml(teams, eventDate, "pdf"),
    eventName,
    eventDate: toIsoDate(eventDate),
    itemCount: buildMilitaryRelayClasses(
      teams,
      config.military.classFilterRegex,
    ).flatMap((classGroup) => classGroup.teams).length,
  };
}

export function generateMilitaryTeamReportHtml(
  individualXml: string,
  options: GenerateReportOptions = {},
): GeneratedReport {
  const { logger, relayXml } = options;

  if (!relayXml) {
    throw new Error("military-team report requires a relay/team IOF XML file.");
  }

  const { participants, eventDate } = parseParticipantsXml(
    individualXml,
    logger,
    pointsFromPosition,
    true,
  );
  const config = loadConfig();
  applyMilitaryIndividualPoints(
    participants,
    config.military.teamFilterRegex,
    config.military.classFilterRegex,
  );
  const { teams: relayTeams, eventName } = parseTeamResultsXml(relayXml, logger, true);
  const standingGroups = buildMilitaryTeamStandingGroups(participants, relayTeams);
  const html = buildMilitaryTeamHtml(participants, relayTeams, eventDate);

  return {
    reportType: "military-team",
    viewHtml: html,
    pdfHtml: html,
    supportsView: false,
    eventName,
    eventDate: toIsoDate(eventDate),
    itemCount: standingGroups.reduce((count, group) => count + group.standings.length, 0),
  };
}

export function generateRogainingReportHtml(
  xml: string,
  options: GenerateReportOptions = {},
): GeneratedReport {
  const { logger } = options;
  const parsed = parseTeamIof(xml);
  const eventDate = normalizeEventDate(parsed.eventDate, logger);

  logger?.info(
    { count: parsed.teams.length },
    "Rogaining teams parsed successfully",
  );

  return {
    reportType: "rogaining",
    viewHtml: buildRogainingHtml(parsed.teams, eventDate, parsed.eventName, "view"),
    pdfHtml: buildRogainingHtml(parsed.teams, eventDate, parsed.eventName, "pdf"),
    eventName: parsed.eventName,
    eventDate: toIsoDate(eventDate),
    itemCount: parsed.teams.length,
  };
}

export function generateRogainingAwardsReportHtml(
  xml: string,
  options: GenerateReportOptions = {},
): GeneratedReport {
  const { logger } = options;
  const parsed = parseTeamIof(xml);
  const eventDate = normalizeEventDate(parsed.eventDate, logger);

  logger?.info(
    { count: parsed.teams.length },
    "Rogaining teams parsed successfully for awards report",
  );

  return {
    reportType: "rogaining-awards",
    viewHtml: buildRogainingAwardsHtml(parsed.teams, eventDate, parsed.eventName, "view"),
    pdfHtml: buildRogainingAwardsHtml(parsed.teams, eventDate, parsed.eventName, "pdf"),
    docx: buildRogainingAwardsDocx(parsed.teams, eventDate, parsed.eventName),
    eventName: parsed.eventName,
    eventDate: toIsoDate(eventDate),
    itemCount: parsed.teams.length,
  };
}

export function generateRogainingDiplomasReportHtml(
  xml: string,
  options: GenerateReportOptions = {},
): GeneratedReport {
  const { logger, includeDiplomaBackground } = options;
  const parsed = parseTeamIof(xml);
  const eventDate = normalizeEventDate(parsed.eventDate, logger);

  logger?.info(
    { count: parsed.teams.length },
    "Rogaining teams parsed successfully for diplomas report",
  );

  return {
    reportType: "rogaining-diplomas",
    viewHtml: buildRogainingDiplomasHtml(parsed.teams, eventDate, parsed.eventName, "view", {
      includeBackground: includeDiplomaBackground ?? false,
    }),
    pdfHtml: buildRogainingDiplomasHtml(parsed.teams, eventDate, parsed.eventName, "pdf", {
      includeBackground: includeDiplomaBackground ?? false,
    }),
    eventName: parsed.eventName,
    eventDate: toIsoDate(eventDate),
    itemCount: parsed.teams.length,
  };
}

export function generateRogainingScoreReportHtml(
  xml: string,
  options: GenerateReportOptions = {},
): GeneratedReport {
  const { logger } = options;
  const parsed = parseTeamIof(xml);
  const eventDate = normalizeEventDate(parsed.eventDate, logger);

  logger?.info(
    { count: parsed.teams.length },
    "Rogaining teams parsed successfully for score report",
  );

  return {
    reportType: "rogaining-score",
    viewHtml: buildRogainingScoreHtml(parsed.teams, eventDate, parsed.eventName, "view"),
    pdfHtml: buildRogainingScoreHtml(parsed.teams, eventDate, parsed.eventName, "pdf"),
    eventName: parsed.eventName,
    eventDate: toIsoDate(eventDate),
    itemCount: buildRogainingScoreEntries(parsed.teams).length,
  };
}

export function generateRogainingResultsReportHtml(
  xml: string,
  options: GenerateReportOptions = {},
): GeneratedReport {
  const { logger, bazaXml } = options;

  if (!bazaXml) {
    throw new Error("rogaining-results report requires a UOF baza XML file.");
  }

  const parsed = parseTeamIof(xml);
  const baza = parseUofBaza(bazaXml);
  const eventDate = normalizeEventDate(parsed.eventDate, logger);

  logger?.info(
    { count: parsed.teams.length, bazaSportsmen: baza.sportsmen.length },
    "Rogaining teams and UOF baza parsed successfully for results report",
  );

  return {
    reportType: "rogaining-results",
    viewHtml: buildRogainingResultsHtml(parsed.teams, baza, eventDate, parsed.eventName, "view"),
    pdfHtml: buildRogainingResultsHtml(parsed.teams, baza, eventDate, parsed.eventName, "pdf"),
    eventName: parsed.eventName,
    eventDate: toIsoDate(eventDate),
    itemCount: parsed.teams.length,
  };
}

export function generateRogainingResultsScoreReportHtml(
  xml: string,
  options: GenerateReportOptions = {},
): GeneratedReport {
  const { logger, bazaXml } = options;

  if (!bazaXml) {
    throw new Error("rogaining-results-score report requires a UOF baza XML file.");
  }

  const parsed = parseTeamIof(xml);
  const baza = parseUofBaza(bazaXml);
  const eventDate = normalizeEventDate(parsed.eventDate, logger);

  logger?.info(
    { count: parsed.teams.length, bazaSportsmen: baza.sportsmen.length },
    "Rogaining teams and UOF baza parsed successfully for results-score report",
  );

  return {
    reportType: "rogaining-results-score",
    viewHtml: buildRogainingResultsScoreHtml(parsed.teams, baza, eventDate, parsed.eventName, "view"),
    pdfHtml: buildRogainingResultsScoreHtml(parsed.teams, baza, eventDate, parsed.eventName, "pdf"),
    eventName: parsed.eventName,
    eventDate: toIsoDate(eventDate),
    itemCount: parsed.teams.length,
  };
}

export function generateRogainingSplitsReportHtml(
  xml: string,
  options: GenerateReportOptions = {},
): GeneratedReport {
  const { logger, courseDataXml } = options;

  if (!courseDataXml) {
    throw new Error("rogaining-splits report requires a CourseData XML file.");
  }

  const parsed = parseTeamIof(xml);
  const courseData = parseCourseData(courseDataXml);
  const eventDate = normalizeEventDate(parsed.eventDate, logger);

  logger?.info(
    { count: parsed.teams.length, controls: courseData.controls.length },
    "Rogaining teams and course data parsed successfully for splits report",
  );

  return {
    reportType: "rogaining-splits",
    viewHtml: buildRogainingSplitsHtml(parsed.teams, courseData, eventDate, parsed.eventName, "view"),
    pdfHtml: buildRogainingSplitsHtml(parsed.teams, courseData, eventDate, parsed.eventName, "pdf"),
    eventName: parsed.eventName,
    eventDate: toIsoDate(eventDate),
    itemCount: buildRogainingSplitTeamEntries(parsed.teams, courseData).length,
  };
}

export function generateReportHtml(
  xml: string,
  reportType: SingleReportType,
  options: GenerateReportOptions = {},
): GeneratedReport {
  switch (reportType) {
    case "individual":
      return generateIndividualReportHtml(xml, options);
    case "team":
      return generateSideBySideTeamReportHtml(xml, options);
    case "side-by-side-rogaining":
      return generateSideBySideRogainingReportHtml(xml, options);
    case "side-by-side-relay":
      return generateSideBySideRelayReportHtml(xml, options);
    case "side-by-side-summary":
      return generateSideBySideSummaryReportHtml(xml, options);
    case "rogaining":
      return generateRogainingReportHtml(xml, options);
    case "rogaining-awards":
      return generateRogainingAwardsReportHtml(xml, options);
    case "rogaining-diplomas":
      return generateRogainingDiplomasReportHtml(xml, options);
    case "rogaining-score":
      return generateRogainingScoreReportHtml(xml, options);
    case "rogaining-results":
      return generateRogainingResultsReportHtml(xml, options);
    case "rogaining-results-score":
      return generateRogainingResultsScoreReportHtml(xml, options);
    case "rogaining-splits":
      return generateRogainingSplitsReportHtml(xml, options);
    case "military-relay":
      return generateMilitaryRelayReportHtml(xml, options);
    case "military-team":
      return generateMilitaryTeamReportHtml(xml, options);
  }
}

export function generateReportsHtml(
  xml: string,
  reportType: ReportType,
  options: GenerateReportOptions = {},
): GeneratedReport[] {
  if (reportType === "all") {
    return [generateIndividualReportHtml(xml, options)];
  }

  return [generateReportHtml(xml, reportType, options)];
}
