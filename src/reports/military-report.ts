import path from "path";
import { loadConfig } from "../config";
import { Participant } from "../io/parse-iof";
import { RogainingTeam } from "../io/parse-rogaining-iof";
import { renderTemplate } from "../render/template-engine";
import { pointsFromPosition } from "../scoring/points";
import { formatDate } from "../utils/date";
import { imageToBase64 } from "../utils/image";

type HtmlVariant = "view" | "pdf";

type MilitaryRelayEntry = {
  place: string;
  teamName: string;
  sourceClassName: string;
  membersLine: string;
  organisation: string;
  formattedTime: string;
  points: number;
  status: string;
};

type MilitaryRelayClass = {
  name: string;
  teams: MilitaryRelayEntry[];
};

type MilitaryTeamStanding = {
  place: number;
  organisation: string;
  individualPoints: number;
  relayPoints: number;
  totalPoints: number;
};

const PLACEABLE_STATUSES = new Set(["OK"]);

function formatTime(sec?: number): string {
  if (sec === undefined) {
    return "";
  }

  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const seconds = sec % 60;

  return `${hours > 0 ? `${hours}:` : ""}${String(minutes).padStart(2, "0")}:${String(
    seconds,
  ).padStart(2, "0")}`;
}

function formatTimeBehind(sec?: number): string {
  if (sec === undefined || sec === 0) {
    return "";
  }

  const minutes = Math.floor(sec / 60);
  const seconds = sec % 60;

  return `+${minutes}:${String(seconds).padStart(2, "0")}`;
}

function buildMilitaryEvent(eventDate: Date, reportTitle: string) {
  const config = loadConfig();
  const logo1Path = path.resolve(__dirname, "../assets/logo1.png");
  const logo2Path = path.resolve(__dirname, "../assets/logo2.png");

  return {
    reportTitle,
    event: {
      title:
        config.reportHeader.title ??
        `Відкритий Кубок Командувача Сухопутних військ ЗСУ<br/>зі спортивного орієнтування (бігом)`,
      location: config.reportHeader.location,
      date: formatDate(eventDate),
      logo1: imageToBase64(logo1Path),
      logo2: imageToBase64(logo2Path),
    },
    officials: config.officials,
  };
}

function rankRelayTeams(teams: RogainingTeam[]): MilitaryRelayEntry[] {
  const sortedTeams = [...teams].sort((left, right) => {
    const leftPlaceable = PLACEABLE_STATUSES.has(left.status);
    const rightPlaceable = PLACEABLE_STATUSES.has(right.status);

    if (leftPlaceable !== rightPlaceable) {
      return leftPlaceable ? -1 : 1;
    }

    const leftTime = left.timeSec ?? Number.MAX_SAFE_INTEGER;
    const rightTime = right.timeSec ?? Number.MAX_SAFE_INTEGER;

    if (leftTime !== rightTime) {
      return leftTime - rightTime;
    }

    return left.teamName.localeCompare(right.teamName, "uk");
  });

  let currentPlace = 0;

  return sortedTeams.map((team) => {
    const place = PLACEABLE_STATUSES.has(team.status) ? currentPlace + 1 : undefined;

    if (place !== undefined) {
      currentPlace = place;
    }

    return {
      place: place === undefined ? "" : String(place),
      teamName: team.teamName,
      sourceClassName: team.className,
      membersLine: team.members.join(", "),
      organisation: team.organisation,
      formattedTime: formatTime(team.timeSec),
      points: pointsFromPosition(place, team.status),
      status: team.status,
    };
  });
}

export function buildMilitaryRelayClasses(teams: RogainingTeam[]): MilitaryRelayClass[] {
  const byClass = new Map<string, RogainingTeam[]>();

  for (const team of teams) {
    const classTeams = byClass.get(team.className) ?? [];
    classTeams.push(team);
    byClass.set(team.className, classTeams);
  }

  return [...byClass.keys()]
    .sort((left, right) => left.localeCompare(right, "uk"))
    .map((className) => ({
      name: className,
      teams: rankRelayTeams(byClass.get(className) ?? []),
    }));
}

export function buildMilitaryTeamStandings(
  participants: Participant[],
  relayTeams: RogainingTeam[],
): MilitaryTeamStanding[] {
  const byOrganisation = new Map<
    string,
    {
      individualPoints: number;
      relayPoints: number;
    }
  >();

  const getEntry = (organisation: string) => {
    const key = organisation.trim() || "Unknown";
    const existing = byOrganisation.get(key);

    if (existing) {
      return existing;
    }

    const created = {
      individualPoints: 0,
      relayPoints: 0,
    };
    byOrganisation.set(key, created);
    return created;
  };

  for (const participant of participants) {
    getEntry(participant.club).individualPoints += participant.points;
  }

  for (const relayEntry of buildMilitaryRelayClasses(relayTeams).flatMap(
    (classGroup) => classGroup.teams,
  )) {
    getEntry(relayEntry.organisation).relayPoints += relayEntry.points;
  }

  return [...byOrganisation.entries()]
    .map(([organisation, points]) => ({
      place: 0,
      organisation,
      individualPoints: points.individualPoints,
      relayPoints: points.relayPoints,
      totalPoints: points.individualPoints + points.relayPoints,
    }))
    .sort((left, right) => {
      if (left.totalPoints !== right.totalPoints) {
        return right.totalPoints - left.totalPoints;
      }

      if (left.individualPoints !== right.individualPoints) {
        return right.individualPoints - left.individualPoints;
      }

      if (left.relayPoints !== right.relayPoints) {
        return right.relayPoints - left.relayPoints;
      }

      return left.organisation.localeCompare(right.organisation, "uk");
    })
    .map((standing, index) => ({
      ...standing,
      place: index + 1,
    }));
}

export function buildMilitaryIndividualHtml(
  participants: Participant[],
  eventDate: Date,
  variant: HtmlVariant = "pdf",
): string {
  const byClass = new Map<string, Participant[]>();

  for (const participant of participants) {
    const classParticipants = byClass.get(participant.className) ?? [];
    classParticipants.push(participant);
    byClass.set(participant.className, classParticipants);
  }

  const classes = [...byClass.keys()].sort((left, right) => left.localeCompare(right, "uk")).map(
    (className) => ({
      name: className,
      participants: [...(byClass.get(className) ?? [])]
        .sort((left, right) => {
          const positionDiff = (left.position ?? 9999) - (right.position ?? 9999);
          return positionDiff !== 0 ? positionDiff : left.name.localeCompare(right.name, "uk");
        })
        .map((participant) => ({
          position: participant.position ?? "",
          name: participant.name,
          organisation: participant.club,
          time: formatTime(participant.timeSec),
          timeBehind: formatTimeBehind(participant.timeBehindSec),
          points: participant.points,
          status: participant.status,
        })),
    }),
  );

  return renderTemplate(`military-individual-${variant}.njk`, {
    ...buildMilitaryEvent(eventDate, "Довга дистанція"),
    classes,
  });
}

export function buildMilitaryRelayHtml(
  teams: RogainingTeam[],
  eventDate: Date,
  variant: HtmlVariant = "pdf",
): string {
  return renderTemplate(`military-relay-${variant}.njk`, {
    ...buildMilitaryEvent(eventDate, "Естафетний протокол Збройних Сил"),
    classes: buildMilitaryRelayClasses(teams),
  });
}

export function buildMilitaryTeamHtml(
  participants: Participant[],
  relayTeams: RogainingTeam[],
  eventDate: Date,
): string {
  return renderTemplate("military-team-pdf.njk", {
    ...buildMilitaryEvent(eventDate, "Командний підсумок Збройних Сил"),
    standings: buildMilitaryTeamStandings(participants, relayTeams),
  });
}
