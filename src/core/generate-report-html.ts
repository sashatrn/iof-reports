import { Logger } from "pino";
import { loadConfig } from "../config";
import { parseCourseData } from "../io/parse-course-data";
import { parseIof } from "../io/parse-iof";
import { parseTeamIof } from "../io/parse-team-iof";
import { parseUofBaza } from "../io/parse-uof-baza";
import { buildIndividualHtml } from "../reports/individual-report";
import { buildIndividualRogainingHtml } from "../reports/individual-rogaining-report";
import {
  buildRogainingDiplomasHtml,
  buildRogainingScoreEntries,
  buildRogainingHtml,
  buildRogainingResultsHtml,
  buildRogainingResultsScoreHtml,
  buildRogainingScoreHtml,
  buildRogainingSplitTeamEntries,
  buildRogainingSplitsHtml,
} from "../reports/rogaining-report";
import { buildRelayClasses, buildRelayHtml } from "../reports/relay-report";
import {
  buildSideBySideRogainingClasses,
  buildSideBySideRogainingHtml,
} from "../reports/side-by-side-rogaining-report";
import { buildSideBySideTeamHtml } from "../reports/side-by-side-team-report";
import { isPdfVisibleParticipant, isPdfVisibleRelayTeam } from "../reports/pdf-status-filter";
import { buildGenderIndividualTeamResults } from "../reports/individual-gender-team-results";
import {
  buildSummaryHtml,
  buildSummaryStandingGroupsFromSources,
  type SummarySource,
} from "../reports/summary-report";
import {
  buildSummaryTeamHtml,
  buildSummaryTeamStandingGroupsFromSources,
  type SummaryTeamSource,
} from "../reports/summary-team-report";
import {
  buildIndividualSummaryTeamGroups,
  buildRelaySummaryTeamGroups,
  buildRogainingSummaryTeamGroups,
  type SummaryTeamSourceType,
} from "../reports/summary-team-source";
import { getIndividualScoring } from "../scoring/individual-scoring";
import { pointsFromPosition } from "../scoring/side-by-side-points";
import { computeTeamResults } from "../scoring/side-by-side-team";
import { ReportType, SingleReportType } from "../report-types";

export type GeneratedReport = {
  reportType: SingleReportType;
  viewHtml: string;
  pdfHtml: string;
  supportsView?: boolean;
  eventName?: string;
  eventDate?: string;
  itemCount: number;
};

type GenerateReportOptions = {
  logger?: Logger;
  includeDiplomaBackground?: boolean;
  courseDataXml?: string;
  bazaXml?: string | Buffer;
  awardsOnly?: boolean;
  summarySeriesXmls?: Array<{
    type: "individual";
    label?: string;
    xml: string;
  }>;
  summaryTeamSeriesXmls?: Array<{
    type: SummaryTeamSourceType;
    label?: string;
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
  const { logger, awardsOnly } = options;
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
    viewHtml: buildIndividualHtml(participants, eventDate, "view", undefined, {
      awardsOnly,
    }),
    pdfHtml: buildIndividualHtml(participants, eventDate, "pdf", teamResults, {
      awardsOnly,
    }),
    eventDate: toIsoDate(eventDate),
    itemCount: participants.length,
  };
}

export function generateIndividualRogainingReportHtml(
  xml: string,
  options: GenerateReportOptions = {},
): GeneratedReport {
  const { logger, awardsOnly } = options;
  const { participants, eventDate } = parseParticipantsXml(
    xml,
    logger,
    () => 0,
    true,
  );

  return {
    reportType: "individual-rogaining",
    viewHtml: buildIndividualRogainingHtml(participants, eventDate, "view", {
      awardsOnly,
    }),
    pdfHtml: buildIndividualRogainingHtml(participants, eventDate, "pdf", {
      awardsOnly,
    }),
    eventDate: toIsoDate(eventDate),
    itemCount: participants.length,
  };
}

export function generateSideBySideTeamReportHtml(
  xml: string,
  options: GenerateReportOptions = {},
): GeneratedReport {
  const { logger, awardsOnly } = options;
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
    viewHtml: buildSideBySideTeamHtml(viewTeamResults, eventDate, "view", {
      awardsOnly,
    }),
    pdfHtml: buildSideBySideTeamHtml(pdfTeamResults, eventDate, "pdf", {
      awardsOnly,
    }),
    eventDate: toIsoDate(eventDate),
    itemCount: pdfTeamResults.men.length + pdfTeamResults.women.length,
  };
}

export function generateSideBySideRogainingReportHtml(
  xml: string,
  options: GenerateReportOptions = {},
): GeneratedReport {
  const { logger, awardsOnly } = options;
  const { participants, eventDate } = parseParticipantsXml(
    xml,
    logger,
    pointsFromPosition,
    true,
  );

  return {
    reportType: "side-by-side-rogaining",
    viewHtml: buildSideBySideRogainingHtml(participants, eventDate, "view", {
      awardsOnly,
    }),
    pdfHtml: buildSideBySideRogainingHtml(participants, eventDate, "pdf", {
      awardsOnly,
    }),
    eventDate: toIsoDate(eventDate),
    itemCount: participants.length,
  };
}

export function generateRelayReportHtml(
  xml: string,
  options: GenerateReportOptions = {},
): GeneratedReport {
  const { logger, awardsOnly } = options;
  const { teams, eventDate, eventName } = parseTeamResultsXml(xml, logger, true);

  return {
    reportType: "relay",
    viewHtml: buildRelayHtml(teams, eventDate, "view", { awardsOnly }),
    pdfHtml: buildRelayHtml(teams, eventDate, "pdf", { awardsOnly }),
    eventName,
    eventDate: toIsoDate(eventDate),
    itemCount: buildRelayClasses(teams).flatMap((classGroup) => classGroup.teams).length,
  };
}

function buildSummarySourceFromXml(
  input: {
    type: "individual";
    label?: string;
    xml: string;
  },
  logger?: Logger,
): {
  source: SummarySource;
  eventDate: Date;
} {
  const config = loadConfig();
  const { participants, eventDate } = parseParticipantsXml(
    input.xml,
    logger,
    () => 0,
    true,
  );
  const pdfParticipants = participants.filter(isPdfVisibleParticipant);

  getIndividualScoring(config.individual.scoring).applyPoints(pdfParticipants, config);

  return {
    source: {
      type: input.type,
      label: input.label,
      participants: pdfParticipants,
    },
    eventDate,
  };
}

export function generateSummaryReportHtml(
  _xml: string,
  options: GenerateReportOptions = {},
): GeneratedReport {
  const { awardsOnly, logger, summarySeriesXmls: inputs = [] } = options;

  if (inputs.length === 0) {
    throw new Error("summary report requires at least one --series source.");
  }

  const parsedSources = inputs.map((input) => buildSummarySourceFromXml(input, logger));
  const eventDate = parsedSources[0].eventDate;
  const sources = parsedSources.map((parsedSource) => parsedSource.source);
  const standingGroups = buildSummaryStandingGroupsFromSources(sources);
  const html = buildSummaryHtml(sources, eventDate, { awardsOnly });

  return {
    reportType: "summary",
    viewHtml: html,
    pdfHtml: html,
    supportsView: false,
    eventDate: toIsoDate(eventDate),
    itemCount: standingGroups.reduce((count, group) => count + group.standings.length, 0),
  };
}

function buildSummaryTeamSourceFromXml(
  input: {
    type: SummaryTeamSourceType;
    label?: string;
    xml: string;
  },
  logger?: Logger,
): {
  source: SummaryTeamSource;
  eventDate: Date;
  eventName?: string;
} {
  const config = loadConfig();

  if (input.type === "relay") {
    const { teams, eventDate, eventName } = parseTeamResultsXml(input.xml, logger, true);
    const classes = buildRelayClasses(teams.filter(isPdfVisibleRelayTeam));

    return {
      source: {
        type: input.type,
        label: input.label,
        groups: buildRelaySummaryTeamGroups(classes, config),
      },
      eventDate,
      eventName,
    };
  }

  const { participants, eventDate } = parseParticipantsXml(
    input.xml,
    logger,
    () => 0,
    true,
  );
  const pdfParticipants = participants.filter(isPdfVisibleParticipant);

  if (input.type === "side-by-side-rogaining") {
    const classes = buildSideBySideRogainingClasses(pdfParticipants);

    return {
      source: {
        type: input.type,
        label: input.label,
        groups: buildRogainingSummaryTeamGroups(classes),
      },
      eventDate,
    };
  }

  getIndividualScoring(config.individual.scoring).applyPoints(pdfParticipants, config);

  return {
    source: {
      type: input.type,
      label: input.label,
      groups: buildIndividualSummaryTeamGroups(pdfParticipants, config, logger),
    },
    eventDate,
  };
}

export function generateSummaryTeamReportHtml(
  _xml: string,
  options: GenerateReportOptions = {},
): GeneratedReport {
  const { awardsOnly, logger, summaryTeamSeriesXmls: inputs = [] } = options;

  if (inputs.length === 0) {
    throw new Error("summary-team report requires at least one --series source.");
  }

  const parsedSources = inputs.map((input) => buildSummaryTeamSourceFromXml(input, logger));
  const eventDate = parsedSources[0].eventDate;
  const eventName = parsedSources.find((parsedSource) => parsedSource.eventName)?.eventName;
  const sources = parsedSources.map((parsedSource) => parsedSource.source);
  const standingGroups = buildSummaryTeamStandingGroupsFromSources(sources);
  const html = buildSummaryTeamHtml(sources, eventDate, { awardsOnly });

  return {
    reportType: "summary-team",
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
  const { awardsOnly, logger } = options;
  const parsed = parseTeamIof(xml);
  const eventDate = normalizeEventDate(parsed.eventDate, logger);

  logger?.info(
    { count: parsed.teams.length },
    "Rogaining teams parsed successfully",
  );

  return {
    reportType: "rogaining",
    viewHtml: buildRogainingHtml(parsed.teams, eventDate, parsed.eventName, "view", {
      awardsOnly,
    }),
    pdfHtml: buildRogainingHtml(parsed.teams, eventDate, parsed.eventName, "pdf", {
      awardsOnly,
    }),
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
  const { awardsOnly, logger } = options;
  const parsed = parseTeamIof(xml);
  const eventDate = normalizeEventDate(parsed.eventDate, logger);

  logger?.info(
    { count: parsed.teams.length },
    "Rogaining teams parsed successfully for score report",
  );

  return {
    reportType: "rogaining-score",
    viewHtml: buildRogainingScoreHtml(parsed.teams, eventDate, parsed.eventName, "view", {
      awardsOnly,
    }),
    pdfHtml: buildRogainingScoreHtml(parsed.teams, eventDate, parsed.eventName, "pdf", {
      awardsOnly,
    }),
    eventName: parsed.eventName,
    eventDate: toIsoDate(eventDate),
    itemCount: buildRogainingScoreEntries(parsed.teams).length,
  };
}

export function generateRogainingResultsReportHtml(
  xml: string,
  options: GenerateReportOptions = {},
): GeneratedReport {
  const { awardsOnly, logger, bazaXml } = options;

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
    viewHtml: buildRogainingResultsHtml(parsed.teams, baza, eventDate, parsed.eventName, "view", {
      awardsOnly,
    }),
    pdfHtml: buildRogainingResultsHtml(parsed.teams, baza, eventDate, parsed.eventName, "pdf", {
      awardsOnly,
    }),
    eventName: parsed.eventName,
    eventDate: toIsoDate(eventDate),
    itemCount: parsed.teams.length,
  };
}

export function generateRogainingResultsScoreReportHtml(
  xml: string,
  options: GenerateReportOptions = {},
): GeneratedReport {
  const { awardsOnly, logger, bazaXml } = options;

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
    viewHtml: buildRogainingResultsScoreHtml(parsed.teams, baza, eventDate, parsed.eventName, "view", {
      awardsOnly,
    }),
    pdfHtml: buildRogainingResultsScoreHtml(parsed.teams, baza, eventDate, parsed.eventName, "pdf", {
      awardsOnly,
    }),
    eventName: parsed.eventName,
    eventDate: toIsoDate(eventDate),
    itemCount: parsed.teams.length,
  };
}

export function generateRogainingSplitsReportHtml(
  xml: string,
  options: GenerateReportOptions = {},
): GeneratedReport {
  const { awardsOnly, logger, courseDataXml } = options;

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
    viewHtml: buildRogainingSplitsHtml(parsed.teams, courseData, eventDate, parsed.eventName, "view", {
      awardsOnly,
    }),
    pdfHtml: buildRogainingSplitsHtml(parsed.teams, courseData, eventDate, parsed.eventName, "pdf", {
      awardsOnly,
    }),
    eventName: parsed.eventName,
    eventDate: toIsoDate(eventDate),
    itemCount: buildRogainingSplitTeamEntries(parsed.teams, courseData, {
      awardsOnly,
    }).length,
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
    case "individual-rogaining":
      return generateIndividualRogainingReportHtml(xml, options);
    case "team":
      return generateSideBySideTeamReportHtml(xml, options);
    case "side-by-side-rogaining":
      return generateSideBySideRogainingReportHtml(xml, options);
    case "relay":
      return generateRelayReportHtml(xml, options);
    case "summary":
      return generateSummaryReportHtml(xml, options);
    case "summary-team":
      return generateSummaryTeamReportHtml(xml, options);
    case "rogaining":
      return generateRogainingReportHtml(xml, options);
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
