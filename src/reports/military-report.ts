import { loadConfig, type AppConfig, type MilitaryIndividualTeamGroupConfig } from "../config";
import { Participant } from "../io/parse-iof";
import { TeamIofTeam } from "../io/parse-team-iof";
import { renderTemplate } from "../render/template-engine";
import {
  buildMilitaryClassFilter,
  buildMilitaryTeamFilter,
  MILITARY_OUT_OF_COMPETITION_POINTS,
} from "../scoring/military-individual-points";
import { formatDate } from "../utils/date";
import { getLeftLogo, getRightLogo } from "./report-logos";
import { buildRelayClassesWithConfig } from "./relay-report";

type MilitaryTeamStanding = {
  place: number;
  organisation: string;
  individualPoints: number;
  relayPoints: number;
  totalPoints: number;
};

type MilitaryTeamStandingGroup = {
  name: string;
  standings: MilitaryTeamStanding[];
};

type MilitaryIndividualTeamResult = {
  place: number;
  organisation: string;
  points: number;
};

type MilitaryIndividualTeamGroup = {
  name: string;
  teams: MilitaryIndividualTeamResult[];
};

function buildMilitaryRelayConfig(config: AppConfig): AppConfig {
  return {
    ...config,
    relay: {
      ...config.relay,
      scoring: "military",
      teamFilterRegex: config.military.teamFilterRegex,
      classFilterRegex: config.military.classFilterRegex,
      classOrderGroups: config.military.individualTeamGroups,
    },
  };
}

function normalizeMilitaryOrganisation(organisation: string): string {
  return organisation.trim() || "Unknown";
}

function buildClassGroupMatchers(
  groups: MilitaryIndividualTeamGroupConfig[],
): Array<MilitaryIndividualTeamGroupConfig & { regex: RegExp }> {
  return groups.map((group, index) => {
    try {
      return {
        ...group,
        regex: new RegExp(group.classRegex),
      };
    } catch (error) {
      throw new Error(
        `Invalid military.individualTeamGroups[${index}].classRegex: ${(error as Error).message}`,
      );
    }
  });
}

function getMilitaryTeamGroupName(
  className: string,
  groupMatchers: Array<MilitaryIndividualTeamGroupConfig & { regex: RegExp }>,
): string {
  return groupMatchers.find((group) => group.regex.test(className))?.name ?? "Загальний залік";
}

function compareConfiguredGroupNames(
  leftGroup: string,
  rightGroup: string,
  teamGroups: MilitaryIndividualTeamGroupConfig[],
): number {
  const leftIndex = teamGroups.findIndex((group) => group.name === leftGroup);
  const rightIndex = teamGroups.findIndex((group) => group.name === rightGroup);

  if (leftIndex !== -1 || rightIndex !== -1) {
    return (leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex) -
      (rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex);
  }

  return leftGroup.localeCompare(rightGroup, "uk");
}

function rankMilitaryTeamStandings(
  pointsByOrganisation: Map<
    string,
    {
      individualPoints: number;
      relayPoints: number;
    }
  >,
): MilitaryTeamStanding[] {
  return [...pointsByOrganisation.entries()]
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

function buildMilitaryEvent(eventDate: Date, reportTitle: string) {
  const config = loadConfig();

  return {
    reportTitle,
    event: {
      title:
        config.reportHeader.title ??
        `Відкритий Кубок Командувача Сухопутних військ ЗСУ<br/>зі спортивного орієнтування (бігом)`,
      location: config.reportHeader.location,
      date: formatDate(eventDate),
      logo1: getLeftLogo(config, "logo1.png"),
      logo2: getRightLogo(config, "zhvi-logo.png"),
    },
    officials: config.officials,
  };
}

export function buildMilitaryTeamStandings(
  participants: Participant[],
  relayTeams: TeamIofTeam[],
): MilitaryTeamStanding[] {
  const config = loadConfig();
  const relayConfig = buildMilitaryRelayConfig(config);
  const classFilter = buildMilitaryClassFilter(config.military.classFilterRegex);
  const teamFilter = buildMilitaryTeamFilter(config.military.teamFilterRegex);
  const byOrganisation = new Map<
    string,
    {
      individualPoints: number;
      relayPoints: number;
    }
  >();

  const getEntry = (organisation: string) => {
    const key = normalizeMilitaryOrganisation(organisation);
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
    const organisation = normalizeMilitaryOrganisation(participant.club);

    if (
      participant.pointsLabel === MILITARY_OUT_OF_COMPETITION_POINTS ||
      !teamFilter.test(organisation) ||
      !classFilter.test(participant.className)
    ) {
      continue;
    }

    getEntry(organisation).individualPoints += participant.points;
  }

  for (const relayEntry of buildRelayClassesWithConfig(
    relayTeams,
    relayConfig,
  ).flatMap((classGroup) => classGroup.teams)) {
    const organisation = normalizeMilitaryOrganisation(relayEntry.organisation);

    if (!teamFilter.test(organisation)) {
      continue;
    }

    getEntry(organisation).relayPoints += relayEntry.points;
  }

  return rankMilitaryTeamStandings(byOrganisation);
}

export function buildMilitaryTeamStandingGroups(
  participants: Participant[],
  relayTeams: TeamIofTeam[],
): MilitaryTeamStandingGroup[] {
  const config = loadConfig();
  const relayConfig = buildMilitaryRelayConfig(config);
  const classFilter = buildMilitaryClassFilter(config.military.classFilterRegex);
  const teamFilter = buildMilitaryTeamFilter(config.military.teamFilterRegex);
  const groupMatchers = buildClassGroupMatchers(config.military.individualTeamGroups);
  const pointsByGroup = new Map<
    string,
    Map<
      string,
      {
        individualPoints: number;
        relayPoints: number;
      }
    >
  >();

  const getEntry = (groupName: string, organisation: string) => {
    const groupPoints = pointsByGroup.get(groupName) ?? new Map<
      string,
      {
        individualPoints: number;
        relayPoints: number;
      }
    >();
    const key = normalizeMilitaryOrganisation(organisation);
    const existing = groupPoints.get(key);

    if (existing) {
      pointsByGroup.set(groupName, groupPoints);
      return existing;
    }

    const created = {
      individualPoints: 0,
      relayPoints: 0,
    };
    groupPoints.set(key, created);
    pointsByGroup.set(groupName, groupPoints);
    return created;
  };

  for (const participant of participants) {
    const organisation = normalizeMilitaryOrganisation(participant.club);

    if (
      participant.pointsLabel === MILITARY_OUT_OF_COMPETITION_POINTS ||
      !teamFilter.test(organisation) ||
      !classFilter.test(participant.className)
    ) {
      continue;
    }

    getEntry(
      getMilitaryTeamGroupName(participant.className, groupMatchers),
      organisation,
    ).individualPoints += participant.points;
  }

  for (const classGroup of buildRelayClassesWithConfig(relayTeams, relayConfig)) {
    if (!classFilter.test(classGroup.name)) {
      continue;
    }

    const groupName = getMilitaryTeamGroupName(classGroup.name, groupMatchers);

    for (const relayEntry of classGroup.teams) {
      const organisation = normalizeMilitaryOrganisation(relayEntry.organisation);

      if (!teamFilter.test(organisation)) {
        continue;
      }

      getEntry(groupName, organisation).relayPoints += relayEntry.points;
    }
  }

  return [...pointsByGroup.entries()]
    .sort(([leftGroup], [rightGroup]) =>
      compareConfiguredGroupNames(leftGroup, rightGroup, config.military.individualTeamGroups),
    )
    .map(([name, pointsByOrganisation]) => ({
      name,
      standings: rankMilitaryTeamStandings(pointsByOrganisation),
    }));
}

export function buildMilitaryIndividualTeamResults(
  participants: Participant[],
  teamFilterRegex: string,
  classFilterRegex: string,
  teamGroups: MilitaryIndividualTeamGroupConfig[],
): MilitaryIndividualTeamGroup[] {
  const teamFilter = buildMilitaryTeamFilter(teamFilterRegex);
  const classFilter = buildMilitaryClassFilter(classFilterRegex);
  const groupMatchers = buildClassGroupMatchers(teamGroups);
  const pointsByGroup = new Map<string, Map<string, number>>();

  for (const participant of participants) {
    const organisation = normalizeMilitaryOrganisation(participant.club);

    if (!classFilter.test(participant.className) || !teamFilter.test(organisation)) {
      continue;
    }

    const groupName =
      groupMatchers.find((group) => group.regex.test(participant.className))?.name ??
      "Загальний залік";
    const pointsByOrganisation = pointsByGroup.get(groupName) ?? new Map<string, number>();

    pointsByOrganisation.set(
      organisation,
      (pointsByOrganisation.get(organisation) ?? 0) + participant.points,
    );
    pointsByGroup.set(groupName, pointsByOrganisation);
  }

  return [...pointsByGroup.entries()]
    .sort(([leftGroup], [rightGroup]) => {
      const leftIndex = teamGroups.findIndex((group) => group.name === leftGroup);
      const rightIndex = teamGroups.findIndex((group) => group.name === rightGroup);

      if (leftIndex !== -1 || rightIndex !== -1) {
        return (leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex) -
          (rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex);
      }

      return leftGroup.localeCompare(rightGroup, "uk");
    })
    .map(([name, pointsByOrganisation]) => ({
      name,
      teams: [...pointsByOrganisation.entries()]
        .map(([organisation, points]) => ({
          place: 0,
          organisation,
          points,
        }))
        .sort((left, right) => {
          if (left.points !== right.points) {
            return right.points - left.points;
          }

          return left.organisation.localeCompare(right.organisation, "uk");
        })
        .map((result, index) => ({
          ...result,
          place: index + 1,
        })),
    }));
}

export function buildMilitaryTeamHtml(
  participants: Participant[],
  relayTeams: TeamIofTeam[],
  eventDate: Date,
): string {
  return renderTemplate("military-team-pdf.njk", {
    ...buildMilitaryEvent(eventDate, "Командний підсумок"),
    standingGroups: buildMilitaryTeamStandingGroups(participants, relayTeams),
  });
}
