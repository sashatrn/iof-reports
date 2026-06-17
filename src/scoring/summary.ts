export type SummarySourceResult = {
  className: string;
  name: string;
  organisation: string;
  points: number;
};

export type SummaryPointSource = {
  key: string;
  label: string;
  results: SummarySourceResult[];
};

export type SummaryStanding = {
  place: number;
  className: string;
  name: string;
  organisation: string;
  sourcePoints: Array<{
    key: string;
    label: string;
    points: number;
  }>;
  totalPoints: number;
};

export type SummaryStandingGroup = {
  name: string;
  standings: SummaryStanding[];
};

function normalizeText(value: string): string {
  return value.trim() || "Unknown";
}

function participantKey(result: SummarySourceResult): string {
  return [
    normalizeText(result.className),
    normalizeText(result.name),
    normalizeText(result.organisation),
  ].join("\u0000");
}

function buildStandingsForClass(
  className: string,
  sources: SummaryPointSource[],
): SummaryStanding[] {
  const participantMeta = new Map<string, {
    name: string;
    organisation: string;
  }>();
  const pointsByParticipant = new Map<string, Map<string, number>>();

  for (const source of sources) {
    for (const result of source.results) {
      if (normalizeText(result.className) !== className) {
        continue;
      }

      const key = participantKey(result);
      const sourcePoints = pointsByParticipant.get(key) ?? new Map<string, number>();

      participantMeta.set(key, {
        name: normalizeText(result.name),
        organisation: normalizeText(result.organisation),
      });
      sourcePoints.set(source.key, (sourcePoints.get(source.key) ?? 0) + result.points);
      pointsByParticipant.set(key, sourcePoints);
    }
  }

  return [...pointsByParticipant.entries()]
    .map(([key, pointsBySource]) => {
      const meta = participantMeta.get(key)!;
      const sourcePoints = sources.map((source) => ({
        key: source.key,
        label: source.label,
        points: pointsBySource.get(source.key) ?? 0,
      }));

      return {
        place: 0,
        className,
        name: meta.name,
        organisation: meta.organisation,
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

      const nameDiff = left.name.localeCompare(right.name, "uk");

      return nameDiff !== 0
        ? nameDiff
        : left.organisation.localeCompare(right.organisation, "uk");
    })
    .map((standing, index) => ({
      ...standing,
      place: index + 1,
    }));
}

export function buildSummaryStandingGroups(
  sources: SummaryPointSource[],
): SummaryStandingGroup[] {
  const classNames = new Set(
    sources.flatMap((source) =>
      source.results.map((result) => normalizeText(result.className)),
    ),
  );

  return [...classNames]
    .sort((left, right) => left.localeCompare(right, "uk"))
    .map((className) => ({
      name: className,
      standings: buildStandingsForClass(className, sources),
    }))
    .filter((group) => group.standings.length > 0);
}
