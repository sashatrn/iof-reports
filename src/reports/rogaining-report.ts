import path from "path";
import { loadConfig } from "../config";
import { RogainingTeam } from "../io/parse-rogaining-iof";
import { renderTemplate } from "../render/template-engine";
import { formatDate } from "../utils/date";
import { imageToBase64 } from "../utils/image";

type HtmlVariant = "view" | "pdf";

type RankedRogainingTeam = RogainingTeam & {
  place: string;
  formattedTime: string;
  membersLine: string;
  sourceClassName: string;
};

const PLACEABLE_STATUSES = new Set(["OK"]);
const OPEN_AGE = Number.POSITIVE_INFINITY;
const YOUTH_MAX_AGE = 23;
const MASTER_MIN_AGE = 45;
const AGGREGATE_OPEN_CLASS = "OPEN";

type ParsedRogainingClass = {
  genderPrefix: string;
  ageLimit: number;
  originalName: string;
};

function formatDuration(sec?: number): string {
  if (sec === undefined) {
    return "";
  }

  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const seconds = sec % 60;

  return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
    2,
    "0",
  )}`;
}

function rankTeams(teams: RogainingTeam[]): RankedRogainingTeam[] {
  const sortableTeams = [...teams].sort((left, right) => {
    const leftPlaceable = PLACEABLE_STATUSES.has(left.status);
    const rightPlaceable = PLACEABLE_STATUSES.has(right.status);

    if (leftPlaceable !== rightPlaceable) {
      return leftPlaceable ? -1 : 1;
    }

    if (leftPlaceable && rightPlaceable) {
      if (left.totalScore !== right.totalScore) {
        return right.totalScore - left.totalScore;
      }

      const leftTime = left.timeSec ?? Number.MAX_SAFE_INTEGER;
      const rightTime = right.timeSec ?? Number.MAX_SAFE_INTEGER;

      if (leftTime !== rightTime) {
        return leftTime - rightTime;
      }
    }

    const leftTime = left.timeSec ?? Number.MAX_SAFE_INTEGER;
    const rightTime = right.timeSec ?? Number.MAX_SAFE_INTEGER;

    if (leftTime !== rightTime) {
      return leftTime - rightTime;
    }

    return left.teamName.localeCompare(right.teamName, "uk");
  });

  let currentPlace = 0;

  return sortableTeams.map((team, index) => {
    if (PLACEABLE_STATUSES.has(team.status)) {
      currentPlace += 1;
    }

    return {
      ...team,
      place: PLACEABLE_STATUSES.has(team.status) ? String(currentPlace) : "",
      formattedTime: formatDuration(team.timeSec),
      membersLine: team.members.join(", "),
      sourceClassName: team.className,
    };
  });
}

function parseRogainingClass(className: string): ParsedRogainingClass | undefined {
  const match = className.trim().match(/^([^\d]+?)\s*(\d+)?$/);

  if (!match) {
    return undefined;
  }

  const genderPrefix = match[1].trim();
  const ageLimit = match[2] ? Number(match[2]) : OPEN_AGE;

  if (!genderPrefix || Number.isNaN(ageLimit)) {
    return undefined;
  }

  return {
    genderPrefix,
    ageLimit,
    originalName: className,
  };
}

function formatRogainingClassName(genderPrefix: string, ageLimit: number): string {
  return ageLimit === OPEN_AGE ? genderPrefix : `${genderPrefix}${ageLimit}`;
}

function getEligibleAgeLimits(
  ageLimit: number,
  declaredAgeLimits: number[],
): number[] {
  if (ageLimit === OPEN_AGE) {
    return [OPEN_AGE];
  }

  const eligible = new Set<number>([ageLimit, OPEN_AGE]);
  const youthClasses = declaredAgeLimits.filter((declaredAgeLimit) => {
    return declaredAgeLimit <= YOUTH_MAX_AGE && ageLimit <= declaredAgeLimit;
  });
  const masterClasses = declaredAgeLimits.filter((declaredAgeLimit) => {
    return declaredAgeLimit >= MASTER_MIN_AGE && ageLimit >= declaredAgeLimit;
  });

  for (const declaredAgeLimit of youthClasses) {
    eligible.add(declaredAgeLimit);
  }

  for (const declaredAgeLimit of masterClasses) {
    eligible.add(declaredAgeLimit);
  }

  return [...eligible];
}

function compareClassAgeLimits(left: number, right: number): number {
  if (left === right) {
    return 0;
  }

  if (left === OPEN_AGE) {
    return 1;
  }

  if (right === OPEN_AGE) {
    return -1;
  }

  const leftYouth = left <= 23;
  const rightYouth = right <= 23;

  if (leftYouth && rightYouth) {
    return left - right;
  }

  if (!leftYouth && !rightYouth) {
    return right - left;
  }

  return leftYouth ? -1 : 1;
}

function buildEligibleClassNames(
  team: RogainingTeam,
  declaredAgeLimitsByPrefix: Map<string, number[]>,
): string[] {
  const parsedClass = parseRogainingClass(team.className);

  if (!parsedClass) {
    return [team.className];
  }

  const declaredAgeLimits =
    declaredAgeLimitsByPrefix.get(parsedClass.genderPrefix) ?? [];

  return getEligibleAgeLimits(parsedClass.ageLimit, declaredAgeLimits)
    .sort(compareClassAgeLimits)
    .map((ageLimit) => formatRogainingClassName(parsedClass.genderPrefix, ageLimit));
}

export function buildRogainingHtml(
  teams: RogainingTeam[],
  eventDate: Date,
  eventName?: string,
  variant: HtmlVariant = "pdf",
): string {
  const config = loadConfig();
  const logo1Path = path.resolve(__dirname, "../assets/logo1.png");
  const logo2Path = path.resolve(__dirname, "../assets/irf-logo.png");

  const byClass = new Map<string, RogainingTeam[]>();
  const declaredClasses = new Set(teams.map((team) => team.className));
  const declaredAgeLimitsByPrefix = new Map<string, number[]>();

  for (const declaredClass of declaredClasses) {
    const parsedClass = parseRogainingClass(declaredClass);

    if (!parsedClass || parsedClass.ageLimit === OPEN_AGE) {
      continue;
    }

    if (!declaredAgeLimitsByPrefix.has(parsedClass.genderPrefix)) {
      declaredAgeLimitsByPrefix.set(parsedClass.genderPrefix, []);
    }

    declaredAgeLimitsByPrefix.get(parsedClass.genderPrefix)!.push(
      parsedClass.ageLimit,
    );
  }

  for (const team of teams) {
    for (const className of buildEligibleClassNames(
      team,
      declaredAgeLimitsByPrefix,
    )) {
      if (!declaredClasses.has(className)) {
        continue;
      }

      if (!byClass.has(className)) {
        byClass.set(className, []);
      }

      byClass.get(className)!.push(team);
    }
  }

  byClass.set(AGGREGATE_OPEN_CLASS, teams);

  const classes = [...byClass.keys()]
    .sort((left, right) => {
      if (left === AGGREGATE_OPEN_CLASS) {
        return 1;
      }

      if (right === AGGREGATE_OPEN_CLASS) {
        return -1;
      }

      const leftParsed = parseRogainingClass(left);
      const rightParsed = parseRogainingClass(right);

      if (!leftParsed || !rightParsed) {
        return left.localeCompare(right, "uk");
      }

      const prefixComparison = leftParsed.genderPrefix.localeCompare(
        rightParsed.genderPrefix,
        "uk",
      );

      if (prefixComparison !== 0) {
        return prefixComparison;
      }

      return compareClassAgeLimits(leftParsed.ageLimit, rightParsed.ageLimit);
    })
    .map((className) => ({
      name: className,
      teams: rankTeams(byClass.get(className)!),
    }))
    .filter((classGroup) => classGroup.teams.length > 0);

  return renderTemplate(`rogaining-${variant}.njk`, {
    reportTitle: "Протокол результатів рогейну",
    event: {
      title:
        config.reportHeader.title ??
        eventName ??
        `Протокол результатів рогейну, ${formatDate(eventDate)}`,
      subtitle: "",
      // "Ранжування: очки мінус штраф; при рівності вище команда з ранішим фінішем. Команди автоматично входять у всі вікові класи, для яких вони придатні.",
      location: config.reportHeader.location,
      date: formatDate(eventDate),
      logo1: imageToBase64(logo1Path),
      logo2: imageToBase64(logo2Path),
    },
    officials: config.officials,
    classes,
  });
}
