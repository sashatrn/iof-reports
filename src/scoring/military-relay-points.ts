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
