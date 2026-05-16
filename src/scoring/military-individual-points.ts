export function militaryIndividualPointsFromPosition(
  position: number | undefined,
  status: string,
): number {
  if (status !== "OK" || position === undefined) return 1;

  if (position === 1) return 45;
  if (position === 2) return 42;
  if (position === 3) return 40;
  if (position === 4) return 38;

  const points = 41 - position;
  return points > 1 ? points : 1;
}
