import { loadConfig } from "../config";
import { TeamIofTeam } from "../io/parse-team-iof";
import { renderTemplate } from "../render/template-engine";
import { pointsFromPosition } from "../scoring/side-by-side-points";
import { isPdfVisibleRelayTeam } from "./pdf-status-filter";
import { formatDate } from "../utils/date";
import { formatResultStatus } from "../utils/result-status";
import { getLeftLogo, getRightLogo } from "./report-logos";

type HtmlVariant = "view" | "pdf";

type SideBySideRelayEntry = {
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
};

type SideBySideRelayClass = {
  name: string;
  teams: SideBySideRelayEntry[];
};

type SideBySideRelayTeamResult = {
  place: number;
  organisation: string;
  points: number;
};

const PLACEABLE_STATUSES = new Set(["OK"]);
const RELAY_INCOMPLETE_STATUS = "DidNotFinish";
const SIDE_BY_SIDE_RELAY_STAGE_COUNT = 3;

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
  if (status === "Active") {
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

function getSideBySideRelayStatus(team: TeamIofTeam): string {
  if (
    !PLACEABLE_STATUSES.has(team.status) &&
    team.status !== RELAY_INCOMPLETE_STATUS &&
    team.status !== "Inactive" &&
    team.status !== "Unknown"
  ) {
    return team.status;
  }

  if (
    team.memberTimeSecs !== undefined &&
    getRelayCompletedStageCount(team) < SIDE_BY_SIDE_RELAY_STAGE_COUNT
  ) {
    return RELAY_INCOMPLETE_STATUS;
  }

  return team.allMembersFinished === false ? RELAY_INCOMPLETE_STATUS : team.status;
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
  return getRelaySortGroup(status) !== 2;
}

function rankRelayTeams(teams: TeamIofTeam[]): SideBySideRelayEntry[] {
  const sortedTeams = [...teams].sort((left, right) => {
    const leftStatus = getSideBySideRelayStatus(left);
    const rightStatus = getSideBySideRelayStatus(right);
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
    const status = getSideBySideRelayStatus(team);

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
    const status = getSideBySideRelayStatus(team);
    const completedStageCount = getRelayCompletedStageCount(team);
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
      stageTimes: Array.from({ length: SIDE_BY_SIDE_RELAY_STAGE_COUNT }, (_, index) =>
        formatRelayStage(team.memberTimeSecs?.[index], team.memberStatuses?.[index]),
      ),
      formattedTime: formatTime(team.timeSec),
      timeBehind:
        bestStageSum === undefined || stageSum === undefined
          ? ""
          : formatTimeBehind(stageSum - bestStageSum),
      points: pointsFromPosition(place, status),
      status,
    };
  });
}

export function buildSideBySideRelayClasses(
  teams: TeamIofTeam[],
): SideBySideRelayClass[] {
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
      teams: rankRelayTeams(byClass.get(className) ?? []),
    }));
}

export function buildSideBySideRelayTeamResults(
  relayClasses: SideBySideRelayClass[],
): SideBySideRelayTeamResult[] {
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

function buildSideBySideEvent(eventDate: Date, reportTitle: string) {
  const config = loadConfig();

  return {
    reportTitle,
    event: {
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
    },
    officials: config.officials,
  };
}

export function buildSideBySideRelayHtml(
  teams: TeamIofTeam[],
  eventDate: Date,
  variant: HtmlVariant = "pdf",
): string {
  const reportTeams = variant === "pdf" ? teams.filter(isPdfVisibleRelayTeam) : teams;
  const classes = buildSideBySideRelayClasses(reportTeams);

  return renderTemplate(`side-by-side-relay-${variant}.njk`, {
    ...buildSideBySideEvent(eventDate, "Естафета"),
    classes,
    teamResults: buildSideBySideRelayTeamResults(classes),
  });
}
