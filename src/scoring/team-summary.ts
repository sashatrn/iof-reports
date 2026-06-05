export type TeamSummarySourceResult = {
  organisation: string;
  points: number;
};

export type TeamSummaryPointSource = {
  key: string;
  label: string;
  results: TeamSummarySourceResult[];
};

export type TeamSummaryStanding = {
  place: number;
  organisation: string;
  sourcePoints: Array<{
    key: string;
    label: string;
    points: number;
  }>;
  totalPoints: number;
};

function normalizeOrganisation(organisation: string): string {
  return organisation.trim() || "Unknown";
}

function getSourcePointEntry(
  sourcePoints: Map<string, number>,
  source: TeamSummaryPointSource,
): number {
  return sourcePoints.get(source.key) ?? 0;
}

export function buildTeamSummaryStandings(
  sources: TeamSummaryPointSource[],
): TeamSummaryStanding[] {
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
        points: getSourcePointEntry(pointsBySource, source),
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
