import { Logger } from "pino";
import { loadConfig } from "../config";
import { parseCourseData } from "../io/parse-course-data";
import { parseIof } from "../io/parse-iof";
import { parseRogainingIof } from "../io/parse-rogaining-iof";
import { parseUofBaza } from "../io/parse-uof-baza";
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
import { buildTeamHtml } from "../reports/team-report";
import { pointsFromPosition } from "../scoring/points";
import { computeTeamResults } from "../scoring/team";
import { ReportType, SingleReportType } from "../report-types";

export type GeneratedReport = {
  reportType: SingleReportType;
  viewHtml: string;
  pdfHtml: string;
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

function parseParticipantsXml(xml: string, logger?: Logger) {
  const parsed = parseIof(xml);
  const eventDate = normalizeEventDate(parsed.eventDate, logger);

  if (parsed.participants.length === 0) {
    throw new Error(
      "No individual athlete results found in IOF XML. If this is a rogaining TeamResult export, use reportType=rogaining.",
    );
  }

  logger?.info(
    { count: parsed.participants.length },
    "Participants parsed successfully",
  );

  for (const participant of parsed.participants) {
    participant.points = pointsFromPosition(participant.position, participant.status);
  }

  return {
    participants: parsed.participants,
    eventDate,
  };
}

export function generateIndividualReportHtml(
  xml: string,
  options: GenerateReportOptions = {},
): GeneratedReport {
  const { logger } = options;
  const { participants, eventDate } = parseParticipantsXml(xml, logger);

  return {
    reportType: "individual",
    viewHtml: buildIndividualHtml(participants, eventDate, "view"),
    pdfHtml: buildIndividualHtml(participants, eventDate, "pdf"),
    eventDate: toIsoDate(eventDate),
    itemCount: participants.length,
  };
}

export function generateTeamReportHtml(
  xml: string,
  options: GenerateReportOptions = {},
): GeneratedReport {
  const { logger } = options;
  const { participants, eventDate } = parseParticipantsXml(xml, logger);
  const config = loadConfig();
  const teamResults = computeTeamResults(participants, config, logger);

  return {
    reportType: "team",
    viewHtml: buildTeamHtml(teamResults, eventDate, "view"),
    pdfHtml: buildTeamHtml(teamResults, eventDate, "pdf"),
    eventDate: toIsoDate(eventDate),
    itemCount: teamResults.men.length + teamResults.women.length,
  };
}

export function generateRogainingReportHtml(
  xml: string,
  options: GenerateReportOptions = {},
): GeneratedReport {
  const { logger } = options;
  const parsed = parseRogainingIof(xml);
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
  const parsed = parseRogainingIof(xml);
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
  const parsed = parseRogainingIof(xml);
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
  const parsed = parseRogainingIof(xml);
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

  const parsed = parseRogainingIof(xml);
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

  const parsed = parseRogainingIof(xml);
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

  const parsed = parseRogainingIof(xml);
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
      return generateTeamReportHtml(xml, options);
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
  }
}

export function generateReportsHtml(
  xml: string,
  reportType: ReportType,
  options: GenerateReportOptions = {},
): GeneratedReport[] {
  if (reportType === "all") {
    return [
      generateIndividualReportHtml(xml, options),
      generateTeamReportHtml(xml, options),
    ];
  }

  return [generateReportHtml(xml, reportType, options)];
}
