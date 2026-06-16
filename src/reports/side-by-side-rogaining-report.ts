import { loadConfig } from "../config";
import { Participant } from "../io/parse-iof";
import { renderTemplate } from "../render/template-engine";
import { pointsFromPosition } from "../scoring/side-by-side-points";
import { isPdfVisibleParticipant } from "./pdf-status-filter";
import { formatDate } from "../utils/date";
import { getLeftLogo, getRightLogo } from "./report-logos";
import {
  type AwardsModeOptions,
  filterAwardPlaces,
  sortAwardClasses,
  withAwardsSubtitle,
} from "./awards-mode";

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

export type SideBySideRogainingClass = {
  name: string;
  participants: SideBySideRogainingParticipant[];
};

type SideBySideRogainingTeamResult = {
  place: number;
  organisation: string;
  points: number;
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

function getScoringStatus(participant: Participant): string {
  return participant.status === "MissingPunch" ? "OK" : participant.status;
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
      points: pointsFromPosition(place, getScoringStatus(participant)),
      status: participant.status,
    };
  });
}

function normalizeOrganisation(organisation: string): string {
  return organisation.trim() || "Unknown";
}

export function buildSideBySideRogainingClasses(
  participants: Participant[],
): SideBySideRogainingClass[] {
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

export function buildSideBySideRogainingTeamResults(
  classes: SideBySideRogainingClass[],
): SideBySideRogainingTeamResult[] {
  const pointsByOrganisation = new Map<string, number>();

  for (const classGroup of classes) {
    const pointsByOrganisationInClass = new Map<string, number[]>();

    for (const participant of classGroup.participants) {
      const organisation = normalizeOrganisation(participant.organisation);
      const points = pointsByOrganisationInClass.get(organisation) ?? [];
      points.push(participant.points);
      pointsByOrganisationInClass.set(organisation, points);
    }

    for (const [organisation, points] of pointsByOrganisationInClass.entries()) {
      const bestPoints = [...points].sort((left, right) => right - left).slice(0, 2);
      const classPoints = bestPoints.reduce((sum, point) => sum + point, 0);
      pointsByOrganisation.set(
        organisation,
        (pointsByOrganisation.get(organisation) ?? 0) + classPoints,
      );
    }
  }

  return [...pointsByOrganisation.entries()]
    .map(([organisation, points]) => ({
      place: 0,
      organisation,
      points,
    }))
    .filter((result) => result.points > 0)
    .sort((left, right) => {
      if (left.points !== right.points) {
        return right.points - left.points;
      }

      return left.organisation.localeCompare(right.organisation, "uk");
    })
    .map((result, index) => ({
      ...result,
      place: index + 1,
    }));
}

function buildSideBySideEvent(
  eventDate: Date,
  options: AwardsModeOptions = {},
) {
  const config = loadConfig();

  return {
    reportTitle: 'Дистанція "За вибором"',
    event: withAwardsSubtitle({
      title:
        config.reportHeader.title ??
        `Всеукраїнські змагання<br/>
        "Пліч-о-пліч всеукраїнські шкільні ліги зі спортивного орієнтування"<br/>
        серед учнів закладів загальної середньої освіти "РАЗОМ ПЕРЕМОЖЕМО"`,
      subtitle: `Протокол загальнокомандних результатів змагань зі спортивного орієнтування<br/>
        ${config.reportHeader.stage} Пліч-о-пліч, Всеукраїнських шкільних ліг<br/>
        ${config.reportHeader.region_of}, ${formatDate(eventDate, "yyyy")} р.`,
      location: config.reportHeader.location,
      date: formatDate(eventDate),
      logo1: getLeftLogo(config, "logo1.png"),
      logo2: getRightLogo(config, "logo2.png"),
    }, options),
    officials: config.officials,
  };
}

export function buildSideBySideRogainingHtml(
  participants: Participant[],
  eventDate: Date,
  variant: HtmlVariant = "pdf",
  options: AwardsModeOptions = {},
): string {
  const config = loadConfig();
  const reportParticipants =
    variant === "pdf" ? participants.filter(isPdfVisibleParticipant) : participants;
  const classes = buildSideBySideRogainingClasses(reportParticipants);
  const displayClasses = sortAwardClasses(classes.map((classGroup) => ({
    ...classGroup,
    participants: filterAwardPlaces(
      classGroup.participants,
      (participant) => participant.position,
      options,
    ),
  })), config.awards.classOrder, options);
  const teamResults =
    variant === "pdf"
      ? filterAwardPlaces(
          buildSideBySideRogainingTeamResults(classes),
          (team) => team.place,
          options,
        )
      : undefined;

  return renderTemplate(`side-by-side-rogaining-${variant}.njk`, {
    ...buildSideBySideEvent(eventDate, options),
    classes: displayClasses,
    teamResults,
  });
}
