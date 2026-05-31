export function pointsFromPosition(
  position: number | undefined,
  status: string,
): number {
  if (status !== "OK" || position === undefined) return 1;

  if (position === 1) return 100;
  if (position === 2) return 95;
  if (position === 3) return 90;
  if (position === 4) return 85;

  const p = 85 - (position - 4);
  return p > 1 ? p : 1;
}
