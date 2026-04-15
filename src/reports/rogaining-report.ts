import path from "path";
import { loadConfig } from "../config";
import { RogainingTeam } from "../io/parse-rogaining-iof";
import { renderTemplate } from "../render/template-engine";
import { formatDate } from "../utils/date";
import { imageToBase64 } from "../utils/image";

type RankedRogainingTeam = RogainingTeam & {
  place: string;
  formattedTime: string;
  membersLine: string;
  sourceClassName: string;
};

const PLACEABLE_STATUSES = new Set(["OK"]);
const OPEN_AGE = Number.POSITIVE_INFINITY;

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

function getEligibleAgeLimits(ageLimit: number): number[] {
  if (ageLimit === OPEN_AGE) {
    return [OPEN_AGE];
  }

  const eligible = new Set<number>([ageLimit, OPEN_AGE]);

  if (ageLimit <= 23) {
    eligible.add(23);
  }

  if (ageLimit >= 45) {
    eligible.add(45);
  }

  if (ageLimit >= 55) {
    eligible.add(55);
  }

  if (ageLimit >= 65) {
    eligible.add(65);
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

function buildEligibleClassNames(team: RogainingTeam): string[] {
  const parsedClass = parseRogainingClass(team.className);

  if (!parsedClass) {
    return [team.className];
  }

  return getEligibleAgeLimits(parsedClass.ageLimit)
    .sort(compareClassAgeLimits)
    .map((ageLimit) => formatRogainingClassName(parsedClass.genderPrefix, ageLimit));
}

export function buildRogainingHtml(
  teams: RogainingTeam[],
  eventDate: Date,
  eventName?: string,
): string {
  const config = loadConfig();
  const logo1Path = path.resolve(__dirname, "../assets/logo1.png");
  const logo2Path = path.resolve(__dirname, "../assets/logo2.png");

  const byClass = new Map<string, RogainingTeam[]>();
  const declaredClasses = new Set(teams.map((team) => team.className));

  for (const team of teams) {
    for (const className of buildEligibleClassNames(team)) {
      if (!declaredClasses.has(className)) {
        continue;
      }

      if (!byClass.has(className)) {
        byClass.set(className, []);
      }

      byClass.get(className)!.push(team);
    }
  }

  const classes = [...byClass.keys()]
    .sort((left, right) => {
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

  return renderTemplate("rogaining.njk", {
    reportTitle: "Протокол результатів рогейну",
    event: {
      title:
        eventName ??
        `Всеукраїнські змагання "Пліч-о-пліч всеукраїнські шкільні ліги зі<br/>
        спортивного орієнтування"`,
      subtitle:
        "Ранжування: очки мінус штраф; при рівності вище команда з ранішим фінішем. Команди автоматично входять у всі вікові класи, для яких вони придатні.",
      location: config.reportHeader.location,
      date: formatDate(eventDate),
      logo1: imageToBase64(logo1Path),
      logo2: imageToBase64(logo2Path),
    },
    officials: config.officials,
    classes,
  });
}
