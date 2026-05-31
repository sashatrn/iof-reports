export function pointsFromPosition(
  position: number | undefined,
  status: string,
): number {
  if (status !== "OK" || position === undefined) return 1;

  if (position === 1) return 100;
  if (position === 2) return 95;
  if (position === 3) return 90;
  if (position === 4) return 85;
  if (position === 5) return 80;

  const p = 80 - (position - 5);
  return p > 1 ? p : 1;
}
