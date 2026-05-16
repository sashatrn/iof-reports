import { XMLParser } from "fast-xml-parser";
import { parseIsoDate } from "../utils/date";

type IofScoreEntry = {
  "#text"?: number | string;
  "@_type"?: string;
};

type RogainingMember = {
  name: string;
  organisation: string;
  controls: string[];
  splits: RogainingSplit[];
  finishTimeSec?: number;
  score?: number;
  penalty?: number;
  status: string;
  overallTimeSec?: number;
  overallStatus?: string;
};

export type RogainingSplit = {
  controlCode: string;
  timeSec?: number;
};

export type RogainingTeam = {
  className: string;
  teamName: string;
  organisation: string;
  members: string[];
  memberOrganisations?: string[];
  memberControls?: string[][];
  memberSplits?: RogainingSplit[][];
  controlGateStatus?: "OK" | "-" | "DSQ";
  memberCount: number;
  score: number;
  penalty: number;
  totalScore: number;
  timeSec?: number;
  status: string;
};

export type ParsedRogainingIof = {
  eventDate?: Date;
  eventName?: string;
  teams: RogainingTeam[];
};

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined || value === null) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }

  return undefined;
}

function findScoreByType(
  score: IofScoreEntry | IofScoreEntry[] | undefined,
  type: string,
): number | undefined {
  for (const entry of asArray(score)) {
    if (entry?.["@_type"] === type) {
      return toNumber(entry["#text"]);
    }
  }

  return undefined;
}

function extractMemberName(memberResult: {
  Person?: {
    Name?: {
      Given?: string | number;
      Family?: string | number;
    };
  };
}): string {
  const given = String(memberResult.Person?.Name?.Given ?? "").trim();
  const family = String(memberResult.Person?.Name?.Family ?? "").trim();
  return [given, family].filter(Boolean).join(" ") || "Unknown";
}

function extractControls(
  splits: RogainingSplit[],
): string[] {
  return splits.map((split) => split.controlCode);
}

function extractSplits(
  splitTime:
    | {
        ControlCode?: string | number;
        Time?: string | number;
      }
    | {
        ControlCode?: string | number;
        Time?: string | number;
      }[]
    | undefined,
): RogainingSplit[] {
  return asArray(splitTime)
    .map((entry) => ({
      controlCode: String(entry?.ControlCode ?? "").trim(),
      timeSec: toNumber(entry?.Time),
    }))
    .filter((entry) => entry.controlCode !== "");
}

function extractOrganisationName(value: unknown): string | undefined {
  const name = String(value ?? "").trim();
  return name === "" ? undefined : name;
}

function isKnownMemberOrganisation(organisation: string): boolean {
  return organisation !== "Unknown" && organisation.toLowerCase() !== "no club";
}

function formatTeamOrganisation(
  memberResults: RogainingMember[],
  teamOrganisationName: unknown,
  classOrganisationName: unknown,
): string {
  const seen = new Set<string>();
  const memberOrganisations: string[] = [];

  for (const member of memberResults) {
    if (!isKnownMemberOrganisation(member.organisation) || seen.has(member.organisation)) {
      continue;
    }

    seen.add(member.organisation);
    memberOrganisations.push(member.organisation);
  }

  if (memberOrganisations.length > 0) {
    return memberOrganisations.join(", ");
  }

  return (
    extractOrganisationName(teamOrganisationName) ??
    memberResults.find((member) => member.organisation !== "Unknown")?.organisation ??
    extractOrganisationName(classOrganisationName) ??
    "Unknown"
  );
}

function normalizeTeam(memberResults: RogainingMember[]): {
  score: number;
  penalty: number;
  timeSec?: number;
  status: string;
} {
  let score: number | undefined;
  let penalty = 0;
  let timeSec: number | undefined;
  let status = "Unknown";

  for (const member of memberResults) {
    if (member.score !== undefined) {
      score = score === undefined ? member.score : Math.min(score, member.score);
    }

    penalty = Math.max(penalty, member.penalty ?? 0);

    if (member.overallTimeSec !== undefined) {
      timeSec =
        timeSec === undefined
          ? member.overallTimeSec
          : Math.max(timeSec, member.overallTimeSec);
    }

    if (member.overallStatus) {
      status = member.overallStatus;
    } else if (member.status && status === "Unknown") {
      status = member.status;
    }
  }

  return {
    score: score ?? 0,
    penalty,
    timeSec,
    status,
  };
}

export function parseRogainingIof(xml: string): ParsedRogainingIof {
  const parser = new XMLParser({
    ignoreAttributes: false,
    removeNSPrefix: true,
  });

  const json = parser.parse(xml);
  const eventDate = parseIsoDate(json?.ResultList?.Event?.StartTime?.Date);
  const eventName = json?.ResultList?.Event?.Name;
  const classResults = asArray(json?.ResultList?.ClassResult);

  const teams: RogainingTeam[] = [];

  for (const classResult of classResults) {
    const className = classResult?.Class?.Name;

    if (!className) {
      continue;
    }

    for (const teamResult of asArray(classResult.TeamResult)) {
      const memberResults = asArray(teamResult?.TeamMemberResult)
        .map((teamMemberResult) => {
          const result = teamMemberResult?.Result;
          const splits = extractSplits(result?.SplitTime);

          return {
            name: extractMemberName(teamMemberResult),
            organisation:
              extractOrganisationName(teamMemberResult?.Organisation?.Name) ??
              "Unknown",
            controls: extractControls(splits),
            splits,
            finishTimeSec: toNumber(result?.Time),
            score: findScoreByType(result?.Score, "Score"),
            penalty: findScoreByType(result?.Score, "Penalty"),
            status: result?.Status ?? "Unknown",
            overallTimeSec: toNumber(result?.OverallResult?.Time),
            overallStatus: result?.OverallResult?.Status,
          };
        })
        .filter((member) => member.name !== "Unknown" || member.status !== "Unknown");

      if (memberResults.length === 0) {
        continue;
      }

      const normalizedTeam = normalizeTeam(memberResults);
      const organisation = formatTeamOrganisation(
        memberResults,
        teamResult?.Organisation?.Name,
        classResult?.Organisation?.Name,
      );

      teams.push({
        className,
        teamName: teamResult?.Name ?? "Unknown",
        organisation,
        members: memberResults.map((member) => member.name),
        memberOrganisations: memberResults.map((member) => member.organisation),
        memberControls: memberResults.map((member) => member.controls),
        memberSplits: memberResults.map((member) => member.splits),
        memberCount: memberResults.length,
        score: normalizedTeam.score,
        penalty: normalizedTeam.penalty,
        totalScore: normalizedTeam.score,
        timeSec: normalizedTeam.timeSec,
        status: normalizedTeam.status,
      });
    }
  }

  return {
    eventDate,
    eventName,
    teams,
  };
}
