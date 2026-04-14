import path from "path";
import { loadConfig } from "../config";
import { RogainingTeam } from "../io/parseRogainingIof";
import { renderTemplate } from "../render/templateEngine";
import { formatDate } from "../utils/date";
import { imageToBase64 } from "../utils/image";

type RankedRogainingTeam = RogainingTeam & {
  place: string;
  formattedTime: string;
  membersLine: string;
};

const PLACEABLE_STATUSES = new Set(["OK"]);

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
    };
  });
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

  for (const team of teams) {
    if (!byClass.has(team.className)) {
      byClass.set(team.className, []);
    }

    byClass.get(team.className)!.push(team);
  }

  const classes = [...byClass.keys()].sort().map((className) => ({
    name: className,
    teams: rankTeams(byClass.get(className)!),
  }));

  return renderTemplate("rogaining.njk", {
    reportTitle: "Протокол результатів рогейну",
    event: {
      title:
        eventName ??
        `Всеукраїнські змагання "Пліч-о-пліч всеукраїнські шкільні ліги зі<br/>
        спортивного орієнтування"`,
      subtitle:
        'Ранжування: очки мінус штраф; при рівності вище команда з ранішим фінішем.',
      location: config.reportHeader.location,
      date: formatDate(eventDate),
      logo1: imageToBase64(logo1Path),
      logo2: imageToBase64(logo2Path),
    },
    officials: config.officials,
    classes,
  });
}
