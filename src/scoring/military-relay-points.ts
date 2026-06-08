const MILITARY_RELAY_POINTS_BY_PLACE = new Map<number, number>([
  [1, 126],
  [2, 111],
  [3, 99],
  [4, 90],
  [5, 81],
  [6, 72],
  [7, 63],
  [8, 54],
  [9, 45],
  [10, 36],
]);

export function militaryRelayPointsFromPlace(
  place: number | undefined,
  status: string,
): number {
  if (status !== "OK" || place === undefined) {
    return 0;
  }

  return MILITARY_RELAY_POINTS_BY_PLACE.get(place) ?? 0;
}

export const applyMilitaryRelayPoints: ApplyRelayPoints = (classes, config) => {
  const teamFilter = new RegExp(config.relay.teamFilterRegex);
  const classFilter = new RegExp(config.relay.classFilterRegex);

  for (const classGroup of classes) {
    const scoredOrganisations = new Set<string>();

    for (const team of classGroup.teams) {
      const organisation = team.organisation.trim() || "Unknown";
      const place = team.place ? Number(team.place) : undefined;
      const canScore =
        classFilter.test(classGroup.name) &&
        teamFilter.test(organisation) &&
        place !== undefined &&
        !scoredOrganisations.has(organisation);

      team.points = canScore
        ? militaryRelayPointsFromPlace(place, team.status)
        : 0;

      if (canScore) {
        scoredOrganisations.add(organisation);
      }
    }
  }
};
import { type ApplyRelayPoints } from "./relay-scoring";
