import { XMLParser } from "fast-xml-parser";
import { loadConfig } from "../config";
import { parseIsoDate } from "../utils/date";

type IofScoreEntry = {
  "#text"?: number | string;
  "@_type"?: string;
};

export type ParsedIof = {
  eventDate?: Date;
  participants: Participant[];
};

export type Participant = {
  className: string;
  name: string;
  club: string;
  timeSec?: number;
  timeBehindSec?: number;
  position?: number;
  status: string;
  points: number;
  pointsLabel?: string;
  controlCount?: number;
};

export function loadIgnoredResultStatuses(): Set<string> {
  return new Set(loadConfig().ignoredStatuses);
}

export function shouldExcludeResultStatus(
  status: string | undefined,
  ignoredStatuses: Set<string> = loadIgnoredResultStatuses(),
): boolean {
  return status !== undefined && ignoredStatuses.has(status);
}

function toOptionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const numberValue = Number(value);
  return Number.isNaN(numberValue) ? undefined : numberValue;
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined || value === null) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function findScoreByType(
  score: IofScoreEntry | IofScoreEntry[] | undefined,
  type: string,
): number | undefined {
  for (const entry of asArray(score)) {
    if (entry?.["@_type"] === type) {
      return toOptionalNumber(entry["#text"]);
    }
  }

  return undefined;
}

function countRecordedControls(
  splitTime:
    | {
        ControlCode?: string | number;
        "@_status"?: string;
      }
    | {
        ControlCode?: string | number;
        "@_status"?: string;
      }[]
    | undefined,
): number | undefined {
  const controls = asArray(splitTime).filter(
    (split) =>
      split?.ControlCode !== undefined &&
      split?.ControlCode !== "" &&
      split?.["@_status"] !== "Missing",
  );

  return controls.length === 0 ? undefined : controls.length;
}

export function parseIof(xml: string): ParsedIof {
  const parser = new XMLParser({
    ignoreAttributes: false,
    removeNSPrefix: true,
  });

  const json = parser.parse(xml);

  const eventDate = parseIsoDate(json?.ResultList?.Event?.StartTime?.Date);

  const classResults = json?.ResultList?.ClassResult;
  const classes = classResults === undefined
    ? []
    : Array.isArray(classResults)
      ? classResults
      : [classResults];
  const ignoredStatuses = loadIgnoredResultStatuses();

  const participants: Participant[] = [];

  for (const cr of classes) {
    const className = cr?.Class?.Name;
    if (!className) {
      continue;
    }

    if (!cr.PersonResult) {
      continue;
    }

    const persons = Array.isArray(cr.PersonResult)
      ? cr.PersonResult
      : [cr.PersonResult];

    for (const pr of persons) {
      const result = pr.Result;
      const status = result?.Status ?? "Unknown";

      if (shouldExcludeResultStatus(status, ignoredStatuses)) {
        continue;
      }

      participants.push({
        className,
        name: `${pr.Person.Name.Given} ${pr.Person.Name.Family}`,
        club: pr.Organisation?.Name ?? "Unknown",
        timeSec: toOptionalNumber(result?.Time),
        timeBehindSec: toOptionalNumber(result?.TimeBehind),
        position: toOptionalNumber(result?.Position),
        status,
        points: 0,
        controlCount:
          findScoreByType(result?.Score, "Score") ??
          countRecordedControls(result?.SplitTime),
      });
    }
  }

  return {
    eventDate,
    participants,
  };
}
