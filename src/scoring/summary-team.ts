import { type SummaryTeamLayoutType } from "../config";

export type SummaryTeamSourceResult = {
  organisation: string;
  points: number;
};

export type SummaryTeamSourceGroup = {
  name?: string;
  results: SummaryTeamSourceResult[];
};

export type SummaryTeamPointSource = {
  key: string;
  label: string;
  groups: SummaryTeamSourceGroup[];
};

export type SummaryTeamStanding = {
  place: number;
  organisation: string;
  sourcePoints: Array<{
    key: string;
    label: string;
    points: number;
  }>;
  totalPoints: number;
};

export type SummaryTeamStandingGroup = {
  name?: string;
  standings: SummaryTeamStanding[];
};

const DEFAULT_GROUP_NAME = "Загальний залік";

function normalizeOrganisation(organisation: string): string {
  return organisation.trim() || "Unknown";
}

function mergeResults(
  results: SummaryTeamSourceResult[],
): SummaryTeamSourceResult[] {
  const pointsByOrganisation = new Map<string, number>();

  for (const result of results) {
    const organisation = normalizeOrganisation(result.organisation);
    pointsByOrganisation.set(
      organisation,
      (pointsByOrganisation.get(organisation) ?? 0) + result.points,
    );
  }

  return [...pointsByOrganisation.entries()].map(([organisation, points]) => ({
    organisation,
    points,
  }));
}

function buildStandings(
  sources: Array<{
    key: string;
    label: string;
    results: SummaryTeamSourceResult[];
  }>,
): SummaryTeamStanding[] {
  const pointsByOrganisation = new Map<string, Map<string, number>>();

  for (const source of sources) {
    for (const result of source.results) {
      if (result.points <= 0) {
        continue;
      }

      const organisation = normalizeOrganisation(result.organisation);
      const sourcePoints = pointsByOrganisation.get(organisation) ?? new Map<string, number>();

      sourcePoints.set(source.key, (sourcePoints.get(source.key) ?? 0) + result.points);
      pointsByOrganisation.set(organisation, sourcePoints);
    }
  }

  return [...pointsByOrganisation.entries()]
    .map(([organisation, pointsBySource]) => {
      const sourcePoints = sources.map((source) => ({
        key: source.key,
        label: source.label,
        points: pointsBySource.get(source.key) ?? 0,
      }));

      return {
        place: 0,
        organisation,
        sourcePoints,
        totalPoints: sourcePoints.reduce((sum, sourcePoint) => sum + sourcePoint.points, 0),
      };
    })
    .filter((standing) => standing.totalPoints > 0)
    .sort((left, right) => {
      if (left.totalPoints !== right.totalPoints) {
        return right.totalPoints - left.totalPoints;
      }

      for (const source of sources) {
        const leftPoints =
          left.sourcePoints.find((sourcePoint) => sourcePoint.key === source.key)?.points ?? 0;
        const rightPoints =
          right.sourcePoints.find((sourcePoint) => sourcePoint.key === source.key)?.points ?? 0;

        if (leftPoints !== rightPoints) {
          return rightPoints - leftPoints;
        }
      }

      return left.organisation.localeCompare(right.organisation, "uk");
    })
    .map((standing, index) => ({
      ...standing,
      place: index + 1,
    }));
}

function compareGroupNames(left: string, right: string, groupOrder: string[]): number {
  const leftIndex = groupOrder.indexOf(left);
  const rightIndex = groupOrder.indexOf(right);

  if (leftIndex !== -1 || rightIndex !== -1) {
    return (leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex) -
      (rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex);
  }

  return left.localeCompare(right, "uk");
}

export function buildSummaryTeamStandingGroups(
  sources: SummaryTeamPointSource[],
  layout: SummaryTeamLayoutType,
  groupOrder: string[] = [],
): SummaryTeamStandingGroup[] {
  if (layout === "flat") {
    return [{
      standings: buildStandings(
        sources.map((source) => ({
          key: source.key,
          label: source.label,
          results: mergeResults(source.groups.flatMap((group) => group.results)),
        })),
      ),
    }];
  }

  const groupNames = new Set(
    sources.flatMap((source) =>
      source.groups.map((group) => group.name ?? DEFAULT_GROUP_NAME),
    ),
  );

  return [...groupNames]
    .sort((left, right) => compareGroupNames(left, right, groupOrder))
    .map((name) => ({
      name,
      standings: buildStandings(
        sources.map((source) => ({
          key: source.key,
          label: source.label,
          results: mergeResults(
            source.groups
              .filter((group) => (group.name ?? DEFAULT_GROUP_NAME) === name)
              .flatMap((group) => group.results),
          ),
        })),
      ),
    }))
    .filter((group) => group.standings.length > 0);
}
