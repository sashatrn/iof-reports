import path from "path";
import { loadConfig } from "../config";
import { Participant } from "../io/parse-iof";
import { renderTemplate } from "../render/template-engine";
import { pointsFromPosition } from "../scoring/side-by-side-points";
import { isPdfVisibleParticipant } from "./pdf-status-filter";
import { formatDate } from "../utils/date";
import { imageToBase64 } from "../utils/image";

type HtmlVariant = "view" | "pdf";

type SideBySideRogainingParticipant = {
  position: string;
  name: string;
  organisation: string;
  controlCount: string;
  time: string;
  timeBehind: string;
  points: number;
  status: string;
};

type RankedParticipant = Participant & {
  rankGroup: number;
};

function formatTime(sec?: number): string {
  if (sec === undefined) {
    return "";
  }

  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const seconds = Math.floor(sec % 60);

  return `${hours > 0 ? `${hours}:` : ""}${String(minutes).padStart(2, "0")}:${String(
    seconds,
  ).padStart(2, "0")}`;
}

function formatTimeBehind(sec?: number): string {
  if (sec === undefined || sec === 0) {
    return "";
  }

  const sign = sec < 0 ? "-" : "+";
  const absoluteSeconds = Math.abs(sec);
  const minutes = Math.floor(absoluteSeconds / 60);
  const seconds = Math.floor(absoluteSeconds % 60);

  return `${sign}${minutes}:${String(seconds).padStart(2, "0")}`;
}

function getRankGroup(participant: Participant): number {
  if (participant.status === "OK") {
    return 0;
  }

  if (participant.status === "MissingPunch") {
    return 1;
  }

  return 2;
}

function compareRankedParticipants(left: RankedParticipant, right: RankedParticipant): number {
  if (left.rankGroup !== right.rankGroup) {
    return left.rankGroup - right.rankGroup;
  }

  if (left.rankGroup === 1 && left.controlCount !== right.controlCount) {
    return (right.controlCount ?? 0) - (left.controlCount ?? 0);
  }

  const timeDiff =
    (left.timeSec ?? Number.MAX_SAFE_INTEGER) - (right.timeSec ?? Number.MAX_SAFE_INTEGER);

  if (timeDiff !== 0) {
    return timeDiff;
  }

  return left.name.localeCompare(right.name, "uk");
}

function getTimeBehind(
  participant: RankedParticipant,
  firstPlaceTime: number | undefined,
): number | undefined {
  if (participant.timeSec === undefined || firstPlaceTime === undefined) {
    return undefined;
  }

  return participant.timeSec - firstPlaceTime;
}

function buildClassParticipants(
  participants: Participant[],
): SideBySideRogainingParticipant[] {
  const rankedParticipants = participants
    .map((participant) => ({
      ...participant,
      rankGroup: getRankGroup(participant),
    }))
    .sort(compareRankedParticipants);
  const firstPlaceTime = rankedParticipants.find(
    (participant) => participant.rankGroup <= 1,
  )?.timeSec;
  let nextPlace = 1;

  return rankedParticipants.map((participant) => {
    const place = participant.rankGroup <= 1 ? nextPlace : undefined;

    if (place !== undefined) {
      nextPlace += 1;
    }

    return {
      position: place === undefined ? "" : String(place),
      name: participant.name,
      organisation: participant.club,
      controlCount: participant.controlCount === undefined ? "" : String(participant.controlCount),
      time: formatTime(participant.timeSec),
      timeBehind: formatTimeBehind(getTimeBehind(participant, firstPlaceTime)),
      points: pointsFromPosition(place, participant.status),
      status: participant.status,
    };
  });
}

export function buildSideBySideRogainingClasses(participants: Participant[]) {
  const byClass = new Map<string, Participant[]>();

  for (const participant of participants) {
    const classParticipants = byClass.get(participant.className) ?? [];
    classParticipants.push(participant);
    byClass.set(participant.className, classParticipants);
  }

  return [...byClass.keys()]
    .sort((left, right) => left.localeCompare(right, "uk"))
    .map((className) => ({
      name: className,
      participants: buildClassParticipants(byClass.get(className) ?? []),
    }));
}

function buildSideBySideEvent(eventDate: Date) {
  const config = loadConfig();
  const logo1Path = path.resolve(__dirname, "../assets/logo1.png");
  const logo2Path = path.resolve(__dirname, "../assets/logo2.png");

  return {
    reportTitle: "Дистанція \"За вибором\"",
    event: {
      title:
        config.reportHeader.title ??
        `Всеукраїнські змагання<br/>
        "Пліч-о-пліч всеукраїнські шкільні ліги зі спортивного орієнтування"<br/>
        серед учнів закладів загальної середньої освіти "РАЗОМ ПЕРЕМОЖЕМО"`,
      subtitle: `Протокол загальнокомандних результатів змагань<br/>
        зі спортивного орієнтування ${config.reportHeader.stage} Пліч-о-пліч, Всеукраїнських шкільних ліг<br/>
        ${config.reportHeader.region_of}, ${formatDate(eventDate, "yyyy")} р.`,
      location: config.reportHeader.location,
      date: formatDate(eventDate),
      logo1: imageToBase64(logo1Path),
      logo2: imageToBase64(logo2Path),
    },
    officials: config.officials,
  };
}

export function buildSideBySideRogainingHtml(
  participants: Participant[],
  eventDate: Date,
  variant: HtmlVariant = "pdf",
): string {
  const reportParticipants =
    variant === "pdf" ? participants.filter(isPdfVisibleParticipant) : participants;

  return renderTemplate(`side-by-side-rogaining-${variant}.njk`, {
    ...buildSideBySideEvent(eventDate),
    classes: buildSideBySideRogainingClasses(reportParticipants),
  });
}
