import { loadConfig, type MilitaryIndividualTeamGroupConfig } from "../config";
import { Participant } from "../io/parse-iof";
import { TeamIofTeam } from "../io/parse-team-iof";
import { renderTemplate } from "../render/template-engine";
import {
  isPdfVisibleRelayTeam,
} from "./pdf-status-filter";
import {
  buildMilitaryClassFilter,
  buildMilitaryTeamFilter,
  MILITARY_OUT_OF_COMPETITION_POINTS,
} from "../scoring/military-individual-points";
import { militaryRelayPointsFromPlace } from "../scoring/military-relay-points";
import { formatDate } from "../utils/date";
import { formatResultStatus } from "../utils/result-status";
import { getLeftLogo, getRightLogo } from "./report-logos";

type HtmlVariant = "view" | "pdf";

type MilitaryRelayEntry = {
  place: string;
  teamName: string;
  sourceClassName: string;
  membersLine: string;
  organisation: string;
  stageTimes: string[];
  formattedTime: string;
  timeBehind: string;
  points: number;
  status: string;
  rowStatus: string;
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

const PLACEABLE_STATUSES = new Set(["OK"]);
const RELAY_INCOMPLETE_STATUS = "DidNotFinish";
const ACTIVE_WITH_RESULT_STATUS = "ActiveWithResult";

function getTeamStageCount(team: TeamIofTeam): number {
  return Math.max(
    team.memberTimeSecs?.length ?? 0,
    team.memberStatuses?.length ?? 0,
    team.members.length,
    team.memberCount,
  );
}

function getRelayStageCount(teams: TeamIofTeam[]): number {
  return teams.reduce((stageCount, team) => {
    return Math.max(stageCount, getTeamStageCount(team));
  }, 0);
}

function getStageNumbers(stageCount: number): number[] {
  return Array.from({ length: stageCount }, (_, index) => index + 1);
}

function normalizeMilitaryOrganisation(organisation: string): string {
  return organisation.trim() || "Unknown";
}

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

  const sign = sec < 0 ? "-" : "+";
  const absoluteSeconds = Math.abs(sec);
  const minutes = Math.floor(absoluteSeconds / 60);
  const seconds = absoluteSeconds % 60;

  return `${sign}${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatRelayStage(timeSec: number | undefined, status: string | undefined): string {
  if (status === "Active" || status === "Inactive") {
    return "";
  }

  if (status !== undefined && status !== "OK") {
    return formatResultStatus(status);
  }

  return formatTime(timeSec);
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

function hasRelayMemberStatus(team: TeamIofTeam, status: string): boolean {
  return team.memberStatuses?.includes(status) ?? false;
}

function hasOnlyRelayMemberStatus(team: TeamIofTeam, status: string): boolean {
  return (
    team.memberStatuses !== undefined &&
    team.memberStatuses.length > 0 &&
    team.memberStatuses.every((memberStatus) => memberStatus === status)
  );
}

function getMilitaryRelayStatus(team: TeamIofTeam, stageCount: number): string {
  if (hasRelayMemberStatus(team, "Active")) {
    return "Active";
  }

  if (hasOnlyRelayMemberStatus(team, "Inactive")) {
    return "Inactive";
  }

  if (
    !PLACEABLE_STATUSES.has(team.status) &&
    team.status !== RELAY_INCOMPLETE_STATUS &&
    team.status !== "Inactive" &&
    team.status !== "Unknown"
  ) {
    return team.status;
  }

  if (team.status === "Inactive") {
    return team.status;
  }

  if (
    team.memberTimeSecs !== undefined &&
    getRelayCompletedStageCount(team) < stageCount
  ) {
    return RELAY_INCOMPLETE_STATUS;
  }

  return team.allMembersFinished === false ? RELAY_INCOMPLETE_STATUS : team.status;
}

function getRelayRowStatus(status: string, completedStageCount: number): string {
  return status === "Active" && completedStageCount > 0 ? ACTIVE_WITH_RESULT_STATUS : status;
}

function getRelayCompletedStageCount(team: TeamIofTeam): number {
  if (team.memberTimeSecs === undefined) {
    return PLACEABLE_STATUSES.has(team.status) ? team.memberCount : 0;
  }

  const memberTimeSecs = team.memberTimeSecs;
  const completedStageCount = memberTimeSecs.filter((timeSec) => timeSec !== undefined).length;
  return completedStageCount;
}

function getRelayProgressTime(team: TeamIofTeam): number {
  const memberTimeSecs = team.memberTimeSecs?.filter((timeSec) => timeSec !== undefined) ?? [];

  if (memberTimeSecs.length > 0) {
    return memberTimeSecs.reduce((sum, timeSec) => sum + timeSec, 0);
  }

  return team.timeSec ?? Number.MAX_SAFE_INTEGER;
}

function getRelayStageSum(team: TeamIofTeam, stageCount: number): number | undefined {
  if (stageCount <= 0) {
    return undefined;
  }

  const memberTimeSecs = team.memberTimeSecs;

  if (memberTimeSecs === undefined) {
    return team.timeSec;
  }

  let sum = 0;

  for (let index = 0; index < stageCount; index += 1) {
    const stageTime = memberTimeSecs[index];

    if (stageTime === undefined) {
      return undefined;
    }

    sum += stageTime;
  }

  return sum;
}

function getRelaySortGroup(status: string): number {
  if (PLACEABLE_STATUSES.has(status)) {
    return 0;
  }

  if (status === RELAY_INCOMPLETE_STATUS) {
    return 1;
  }

  return 2;
}

function canUseRelayTeamAsStageLeader(status: string): boolean {
  return status === "Active" || getRelaySortGroup(status) !== 2;
}

function rankRelayTeams(
  teams: TeamIofTeam[],
  classCanScore = true,
  stageCount = getRelayStageCount(teams),
): MilitaryRelayEntry[] {
  const sortedTeams = [...teams].sort((left, right) => {
    const leftStatus = getMilitaryRelayStatus(left, stageCount);
    const rightStatus = getMilitaryRelayStatus(right, stageCount);
    const leftSortGroup = getRelaySortGroup(leftStatus);
    const rightSortGroup = getRelaySortGroup(rightStatus);

    if (leftSortGroup !== rightSortGroup) {
      return leftSortGroup - rightSortGroup;
    }

    const leftCompletedStageCount = getRelayCompletedStageCount(left);
    const rightCompletedStageCount = getRelayCompletedStageCount(right);

    if (leftCompletedStageCount !== rightCompletedStageCount) {
      return rightCompletedStageCount - leftCompletedStageCount;
    }

    const leftTime = getRelayProgressTime(left);
    const rightTime = getRelayProgressTime(right);

    if (leftTime !== rightTime) {
      return leftTime - rightTime;
    }

    const leftPlaceable = PLACEABLE_STATUSES.has(leftStatus);
    const rightPlaceable = PLACEABLE_STATUSES.has(rightStatus);

    if (leftPlaceable !== rightPlaceable) {
      return leftPlaceable ? -1 : 1;
    }

    return left.teamName.localeCompare(right.teamName, "uk");
  });

  let currentPlace = 0;
  const scoredOrganisations = new Set<string>();
  const bestStageSumByStageCount = new Map<number, number>();

  for (const team of sortedTeams) {
    const status = getMilitaryRelayStatus(team, stageCount);

    if (!canUseRelayTeamAsStageLeader(status)) {
      continue;
    }

    const completedStageCount = getRelayCompletedStageCount(team);

    for (let stageCount = 1; stageCount <= completedStageCount; stageCount += 1) {
      const stageSum = getRelayStageSum(team, stageCount);

      if (stageSum === undefined) {
        continue;
      }

      const bestStageSum = bestStageSumByStageCount.get(stageCount);

      if (bestStageSum === undefined || stageSum < bestStageSum) {
        bestStageSumByStageCount.set(stageCount, stageSum);
      }
    }
  }

  return sortedTeams.map((team) => {
    const status = getMilitaryRelayStatus(team, stageCount);
    const completedStageCount = getRelayCompletedStageCount(team);
    const stageSum = getRelayStageSum(team, completedStageCount);
    const bestStageSum = bestStageSumByStageCount.get(completedStageCount);
    const place = PLACEABLE_STATUSES.has(status) ? currentPlace + 1 : undefined;

    if (place !== undefined) {
      currentPlace = place;
    }

    const organisationKey = normalizeMilitaryOrganisation(team.organisation);
    const canScore =
      classCanScore && place !== undefined && !scoredOrganisations.has(organisationKey);

    if (canScore) {
      scoredOrganisations.add(organisationKey);
    }

    return {
      place: place === undefined ? "" : String(place),
      teamName: team.teamName,
      sourceClassName: team.className,
      membersLine: team.members.join(", "),
      organisation: team.organisation,
      stageTimes: Array.from({ length: stageCount }, (_, index) =>
        formatRelayStage(team.memberTimeSecs?.[index], team.memberStatuses?.[index]),
      ),
      formattedTime: formatTime(team.timeSec),
      timeBehind:
        bestStageSum === undefined || stageSum === undefined
          ? ""
          : formatTimeBehind(stageSum - bestStageSum),
      points: canScore ? militaryRelayPointsFromPlace(place, status) : 0,
      status,
      rowStatus: getRelayRowStatus(status, completedStageCount),
    };
  });
}

export function buildMilitaryRelayClasses(
  teams: TeamIofTeam[],
  classFilterRegex = ".*",
  stageCount = getRelayStageCount(teams),
): MilitaryRelayClass[] {
  const classFilter = buildMilitaryClassFilter(classFilterRegex);
  const byClass = new Map<string, TeamIofTeam[]>();

  for (const team of teams) {
    const classTeams = byClass.get(team.className) ?? [];
    classTeams.push(team);
    byClass.set(team.className, classTeams);
  }

  return [...byClass.keys()]
    .sort((left, right) => left.localeCompare(right, "uk"))
    .map((className) => ({
      name: className,
      teams: rankRelayTeams(
        byClass.get(className) ?? [],
        classFilter.test(className),
        stageCount,
      ),
    }));
}

export function buildMilitaryTeamStandings(
  participants: Participant[],
  relayTeams: TeamIofTeam[],
): MilitaryTeamStanding[] {
  const config = loadConfig();
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

  for (const relayEntry of buildMilitaryRelayClasses(
    relayTeams,
    config.military.classFilterRegex,
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

  for (const classGroup of buildMilitaryRelayClasses(
    relayTeams,
    config.military.classFilterRegex,
  )) {
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

export function buildMilitaryRelayTeamResults(
  relayClasses: MilitaryRelayClass[],
  teamFilterRegex: string,
  classFilterRegex: string,
  teamGroups: MilitaryIndividualTeamGroupConfig[],
): MilitaryIndividualTeamGroup[] {
  const teamFilter = buildMilitaryTeamFilter(teamFilterRegex);
  const classFilter = buildMilitaryClassFilter(classFilterRegex);
  const groupMatchers = buildClassGroupMatchers(teamGroups);
  const pointsByGroup = new Map<string, Map<string, number>>();

  for (const classGroup of relayClasses) {
    if (!classFilter.test(classGroup.name)) {
      continue;
    }

    const groupName =
      groupMatchers.find((group) => group.regex.test(classGroup.name))?.name ??
      "Загальний залік";

    for (const team of classGroup.teams) {
      const organisation = normalizeMilitaryOrganisation(team.organisation);

      if (!teamFilter.test(organisation)) {
        continue;
      }

      const pointsByOrganisation = pointsByGroup.get(groupName) ?? new Map<string, number>();

      pointsByOrganisation.set(
        organisation,
        (pointsByOrganisation.get(organisation) ?? 0) + team.points,
      );
      pointsByGroup.set(groupName, pointsByOrganisation);
    }
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

export function buildMilitaryRelayHtml(
  teams: TeamIofTeam[],
  eventDate: Date,
  variant: HtmlVariant = "pdf",
): string {
  const config = loadConfig();
  const reportTeams = variant === "pdf" ? teams.filter(isPdfVisibleRelayTeam) : teams;
  const stageCount = getRelayStageCount(reportTeams);
  const classes = buildMilitaryRelayClasses(
    reportTeams,
    config.military.classFilterRegex,
    stageCount,
  );

  return renderTemplate(`military-relay-${variant}.njk`, {
    ...buildMilitaryEvent(eventDate, "Естафета"),
    classes,
    stageNumbers: getStageNumbers(stageCount),
    teamResults: buildMilitaryRelayTeamResults(
      classes,
      config.military.teamFilterRegex,
      config.military.classFilterRegex,
      config.military.individualTeamGroups,
    ),
  });
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
