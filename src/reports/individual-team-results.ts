import { type ClassGroupConfig, type IndividualTeamResultLimit } from "../config";
import { Participant } from "../io/parse-iof";
import {
  buildMilitaryClassFilter,
  buildMilitaryTeamFilter,
} from "../scoring/military-individual-points";

export type GroupedIndividualTeamResult = {
  place: number;
  organisation: string;
  points: number;
};

export type GroupedIndividualTeamResults = {
  name: string;
  teams: GroupedIndividualTeamResult[];
};

function normalizeOrganisation(organisation: string): string {
  return organisation.trim() || "Unknown";
}

function buildClassGroupMatchers(
  groups: ClassGroupConfig[],
): Array<ClassGroupConfig & { regex: RegExp }> {
  return groups.map((group, index) => {
    try {
      return {
        ...group,
        regex: new RegExp(group.classRegex),
      };
    } catch (error) {
      throw new Error(
        `Invalid individual.classOrderGroups[${index}].classRegex: ${(error as Error).message}`,
      );
    }
  });
}

function compareConfiguredGroupNames(
  leftGroup: string,
  rightGroup: string,
  teamGroups: ClassGroupConfig[],
): number {
  const leftIndex = teamGroups.findIndex((group) => group.name === leftGroup);
  const rightIndex = teamGroups.findIndex((group) => group.name === rightGroup);

  if (leftIndex !== -1 || rightIndex !== -1) {
    return (leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex) -
      (rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex);
  }

  return leftGroup.localeCompare(rightGroup, "uk");
}

export function buildGroupedIndividualTeamResults(
  participants: Participant[],
  teamFilterRegex: string,
  classFilterRegex: string,
  teamGroups: ClassGroupConfig[],
  teamResultLimits: IndividualTeamResultLimit[] = [],
): GroupedIndividualTeamResults[] {
  const teamFilter = buildMilitaryTeamFilter(teamFilterRegex);
  const classFilter = buildMilitaryClassFilter(classFilterRegex);
  const groupMatchers = buildClassGroupMatchers(teamGroups);
  const limitMatchers = teamResultLimits.map((limit, index) => {
    if (!Number.isInteger(limit.count) || limit.count < 0) {
      throw new Error(`Invalid individual.teamResultLimits[${index}].count: expected a non-negative integer.`);
    }
    try {
      return { ...limit, regex: new RegExp(limit.classRegex) };
    } catch (error) {
      throw new Error(`Invalid individual.teamResultLimits[${index}].classRegex: ${(error as Error).message}`);
    }
  });
  const participantsByGroup = new Map<string, Map<string, Participant[]>>();

  for (const participant of participants) {
    const organisation = normalizeOrganisation(participant.club);

    if (!classFilter.test(participant.className) || !teamFilter.test(organisation)) {
      continue;
    }

    const groupName =
      groupMatchers.find((group) => group.regex.test(participant.className))?.name ??
      "Загальний залік";
    const groupParticipants = participantsByGroup.get(groupName) ?? new Map<string, Participant[]>();

    groupParticipants.set(
      organisation,
      [...(groupParticipants.get(organisation) ?? []), participant],
    );
    participantsByGroup.set(groupName, groupParticipants);
  }

  function countTeamPoints(teamParticipants: Participant[]): number {
    if (limitMatchers.length === 0) {
      return teamParticipants.reduce((sum, participant) => sum + participant.points, 0);
    }

    const counts = limitMatchers.map(() => 0);
    return [...teamParticipants]
      .filter((participant) => participant.status === "OK" && participant.points > 0)
      .sort((left, right) => right.points - left.points)
      .reduce((sum, participant) => {
        const index = limitMatchers.findIndex((limit) => limit.regex.test(participant.className));
        if (index === -1 || counts[index] >= limitMatchers[index].count) return sum;
        counts[index] += 1;
        return sum + participant.points;
      }, 0);
  }

  return [...participantsByGroup.entries()]
    .sort(([leftGroup], [rightGroup]) =>
      compareConfiguredGroupNames(leftGroup, rightGroup, teamGroups),
    )
    .map(([name, participantsByOrganisation]) => ({
      name,
      teams: [...participantsByOrganisation.entries()]
        .map(([organisation, teamParticipants]) => ({
          place: 0,
          organisation,
          points: countTeamPoints(teamParticipants),
        }))
        .sort((left, right) => {
          if (left.points !== right.points) {
            return right.points - left.points;
          }

          return left.organisation.localeCompare(right.organisation, "uk");
        })
        .map((team, index) => ({
          ...team,
          place: index + 1,
        })),
    }));
}
