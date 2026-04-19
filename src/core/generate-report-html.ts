import { Logger } from "pino";
import { loadConfig } from "../config";
import { parseIof } from "../io/parse-iof";
import { parseRogainingIof } from "../io/parse-rogaining-iof";
import { buildIndividualHtml } from "../reports/individual-report";
import { buildRogainingHtml } from "../reports/rogaining-report";
import { buildTeamHtml } from "../reports/team-report";
import { pointsFromPosition } from "../scoring/points";
import { computeTeamResults } from "../scoring/team";
import { ReportType, SingleReportType } from "../report-types";

export type GeneratedReport = {
  reportType: SingleReportType;
  viewHtml: string;
  pdfHtml: string;
  eventName?: string;
  eventDate?: string;
  itemCount: number;
};

type GenerateReportOptions = {
  logger?: Logger;
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
