import { loadConfig, type AppConfig, type ClassGroupConfig, type RelayScoringType } from "../config";
import { TeamIofTeam } from "../io/parse-team-iof";
import { renderTemplate } from "../render/template-engine";
import { getRelayScoring } from "../scoring/relay-scoring";
import { isPdfVisibleRelayTeam } from "./pdf-status-filter";
import { formatDate } from "../utils/date";
import { formatResultStatus } from "../utils/result-status";
import { getLeftLogo } from "./report-logos";
import {
  type AwardsModeOptions,
  filterAwardPlaces,
  withAwardsSubtitle,
} from "./awards-mode";

type HtmlVariant = "view" | "pdf";

export type RelayEntry = {
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
  completedStageCount: number;
  teamStageCount: number;
};

export type RelayClass = {
  name: string;
  teams: RelayEntry[];
};

export type RelayTeamResult = {
  place: number;
  organisation: string;
  points: number;
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

function normalizeOrganisation(organisation: string): string {
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

function getRelayCompletedStageCount(team: TeamIofTeam): number {
  if (team.memberTimeSecs === undefined) {
    return PLACEABLE_STATUSES.has(team.status) ? team.memberCount : 0;
  }

  return team.memberTimeSecs.filter((timeSec) => timeSec !== undefined).length;
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

function getRelayStatus(team: TeamIofTeam, stageCount: number): string {
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

  if (team.status === RELAY_INCOMPLETE_STATUS) {
    return RELAY_INCOMPLETE_STATUS;
  }

  const completedStageCount = getRelayCompletedStageCount(team);

  if (
    team.memberTimeSecs !== undefined &&
    completedStageCount > 0 &&
    completedStageCount < stageCount
  ) {
    return "Active";
  }

  if (
    team.memberTimeSecs !== undefined &&
    completedStageCount < stageCount
  ) {
    return RELAY_INCOMPLETE_STATUS;
  }

  return team.allMembersFinished === false ? RELAY_INCOMPLETE_STATUS : team.status;
}

function getRelayRowStatus(status: string, completedStageCount: number): string {
  return status === "Active" && completedStageCount > 0 ? ACTIVE_WITH_RESULT_STATUS : status;
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

function rankRelayTeams(teams: TeamIofTeam[], stageCount: number): RelayEntry[] {
  const sortedTeams = [...teams].sort((left, right) => {
    const leftStatus = getRelayStatus(left, stageCount);
    const rightStatus = getRelayStatus(right, stageCount);
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
  const bestStageSumByStageCount = new Map<number, number>();

  for (const team of sortedTeams) {
    const status = getRelayStatus(team, stageCount);

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
    const status = getRelayStatus(team, stageCount);
    const completedStageCount = getRelayCompletedStageCount(team);
    const teamStageCount = getTeamStageCount(team);
    const stageSum = getRelayStageSum(team, completedStageCount);
    const bestStageSum = bestStageSumByStageCount.get(completedStageCount);
    const place = PLACEABLE_STATUSES.has(status) ? currentPlace + 1 : undefined;

    if (place !== undefined) {
      currentPlace = place;
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
      points: 0,
      status,
      rowStatus: getRelayRowStatus(status, completedStageCount),
      completedStageCount,
      teamStageCount,
    };
  });
}

function buildClassGroupMatchers(groups: ClassGroupConfig[]) {
  return groups.map((group) => ({
    ...group,
    regex: new RegExp(group.classRegex),
  }));
}

function compareClassNames(left: string, right: string, config: AppConfig): number {
  if (config.relay.classOrder !== "grouped") {
    return left.localeCompare(right, "uk");
  }

  const matchers = buildClassGroupMatchers(config.relay.classOrderGroups);
  const leftIndex = matchers.findIndex((group) => group.regex.test(left));
  const rightIndex = matchers.findIndex((group) => group.regex.test(right));

  if (leftIndex !== rightIndex) {
    return (leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex) -
      (rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex);
  }

  return left.localeCompare(right, "uk");
}

export function buildRelayClasses(
  teams: TeamIofTeam[],
  stageCount = getRelayStageCount(teams),
  scoringType?: RelayScoringType,
): RelayClass[] {
  const config = loadConfig();
  return buildRelayClassesWithConfig(teams, config, stageCount, scoringType);
}

export function buildRelayClassesWithConfig(
  teams: TeamIofTeam[],
  config: AppConfig,
  stageCount = getRelayStageCount(teams),
  scoringType?: RelayScoringType,
): RelayClass[] {
  const byClass = new Map<string, TeamIofTeam[]>();

  for (const team of teams) {
    const classTeams = byClass.get(team.className) ?? [];
    classTeams.push(team);
    byClass.set(team.className, classTeams);
  }

  const classes = [...byClass.keys()]
    .sort((left, right) => compareClassNames(left, right, config))
    .map((className) => ({
      name: className,
      teams: rankRelayTeams(byClass.get(className) ?? [], stageCount),
    }));

  getRelayScoring(scoringType ?? config.relay.scoring).applyPoints(classes, config);
  return classes;
}

export function buildFlatRelayTeamResults(
  relayClasses: RelayClass[],
): RelayTeamResult[] {
  const pointsByOrganisation = new Map<string, number>();

  for (const classGroup of relayClasses) {
    const pointsByOrganisationInClass = new Map<string, number[]>();

    for (const relayEntry of classGroup.teams) {
      const organisation = normalizeOrganisation(relayEntry.organisation);
      const points = pointsByOrganisationInClass.get(organisation) ?? [];
      points.push(relayEntry.points);
      pointsByOrganisationInClass.set(organisation, points);
    }

    for (const [organisation, points] of pointsByOrganisationInClass.entries()) {
      const classPoints = Math.max(...points);
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

export function buildGroupedRelayTeamResults(
  relayClasses: RelayClass[],
  config: AppConfig = loadConfig(),
) {
  const teamFilter = new RegExp(config.relay.teamFilterRegex);
  const classFilter = new RegExp(config.relay.classFilterRegex);
  const matchers = buildClassGroupMatchers(config.relay.classOrderGroups);
  const pointsByGroup = new Map<string, Map<string, number>>();

  for (const classGroup of relayClasses) {
    if (!classFilter.test(classGroup.name)) continue;
    const groupName =
      matchers.find((group) => group.regex.test(classGroup.name))?.name ??
      "Загальний залік";
    const groupPoints = pointsByGroup.get(groupName) ?? new Map<string, number>();

    for (const team of classGroup.teams) {
      const organisation = normalizeOrganisation(team.organisation);
      if (!teamFilter.test(organisation)) continue;
      groupPoints.set(organisation, (groupPoints.get(organisation) ?? 0) + team.points);
    }

    pointsByGroup.set(groupName, groupPoints);
  }

  return [...pointsByGroup.entries()].map(([name, points]) => ({
    name,
    teams: [...points.entries()]
      .map(([organisation, teamPoints]) => ({ place: 0, organisation, points: teamPoints }))
      .sort((left, right) => right.points - left.points || left.organisation.localeCompare(right.organisation, "uk"))
      .map((team, index) => ({ ...team, place: index + 1 })),
  }));
}

function renderRelayTemplateText(template: string | undefined, eventDate: Date, config: AppConfig) {
  return template
    ?.replaceAll("{{stage}}", config.reportHeader.stage)
    .replaceAll("{{region_of}}", config.reportHeader.region_of)
    .replaceAll("{{year}}", formatDate(eventDate, "yyyy"));
}

function buildRelayEvent(
  eventDate: Date,
  config: AppConfig,
  options: AwardsModeOptions = {},
) {

  return {
    reportTitle: config.relay.reportTitle,
    event: withAwardsSubtitle({
      title:
        config.reportHeader.title ??
        renderRelayTemplateText(config.relay.title, eventDate, config),
      subtitle: renderRelayTemplateText(config.relay.subtitle, eventDate, config),
      location: config.reportHeader.location,
      date: formatDate(eventDate),
      logo1: getLeftLogo(config, "logo1.png"),
      logo2: config.rightLogo,
    }, options),
    officials: config.officials,
  };
}

export function buildRelayHtml(
  teams: TeamIofTeam[],
  eventDate: Date,
  variant: HtmlVariant = "pdf",
  options: AwardsModeOptions = {},
): string {
  const reportTeams = variant === "pdf" ? teams.filter(isPdfVisibleRelayTeam) : teams;
  const config = loadConfig();
  const stageCount = getRelayStageCount(reportTeams);
  const classes = buildRelayClasses(reportTeams, stageCount);
  const teamResults =
    config.relay.teamResults === "flat"
      ? { mode: "flat", teams: buildFlatRelayTeamResults(classes) }
      : config.relay.teamResults === "grouped"
        ? { mode: "grouped", groups: buildGroupedRelayTeamResults(classes, config) }
        : undefined;
  const displayClasses = classes.map((classGroup) => ({
    ...classGroup,
    teams: filterAwardPlaces(classGroup.teams, (team) => team.place, options),
  }));
  const displayTeamResults = !teamResults || !options.awardsOnly
    ? teamResults
    : teamResults.mode === "flat"
      ? {
          mode: "flat" as const,
          teams: filterAwardPlaces(teamResults.teams ?? [], (team) => team.place, options),
        }
      : {
          mode: "grouped" as const,
          groups: (teamResults.groups ?? []).map((group) => ({
            ...group,
            teams: filterAwardPlaces(group.teams, (team) => team.place, options),
          })),
        };

  return renderTemplate(`relay-${variant}.njk`, {
    ...buildRelayEvent(eventDate, config, options),
    classes: displayClasses,
    stageNumbers: getStageNumbers(stageCount),
    teamResults: displayTeamResults,
    relay: config.relay,
  });
}
