import { type ClassGroupConfig } from "../config";
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
): GroupedIndividualTeamResults[] {
  const teamFilter = buildMilitaryTeamFilter(teamFilterRegex);
  const classFilter = buildMilitaryClassFilter(classFilterRegex);
  const groupMatchers = buildClassGroupMatchers(teamGroups);
  const pointsByGroup = new Map<string, Map<string, number>>();

  for (const participant of participants) {
    const organisation = normalizeOrganisation(participant.club);

    if (!classFilter.test(participant.className) || !teamFilter.test(organisation)) {
      continue;
    }

    const groupName =
      groupMatchers.find((group) => group.regex.test(participant.className))?.name ??
      "Загальний залік";
    const groupPoints = pointsByGroup.get(groupName) ?? new Map<string, number>();

    groupPoints.set(
      organisation,
      (groupPoints.get(organisation) ?? 0) + participant.points,
    );
    pointsByGroup.set(groupName, groupPoints);
  }

  return [...pointsByGroup.entries()]
    .sort(([leftGroup], [rightGroup]) =>
      compareConfiguredGroupNames(leftGroup, rightGroup, teamGroups),
    )
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
        .map((team, index) => ({
          ...team,
          place: index + 1,
        })),
    }));
}
