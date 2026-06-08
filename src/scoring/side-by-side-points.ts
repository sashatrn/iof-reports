import { type AppConfig } from "../config";
import { type Participant } from "../io/parse-iof";
import { type ApplyRelayPoints } from "./relay-scoring";

export function pointsFromPosition(
  position: number | undefined,
  status: string,
): number {
  if (status === "Active" || status === "Inactive") return 0;
  if (status !== "OK" || position === undefined) return 1;

  if (position === 1) return 100;
  if (position === 2) return 95;
  if (position === 3) return 90;
  if (position === 4) return 85;

  const p = 85 - (position - 4);
  return p > 1 ? p : 1;
}

export function applySideBySideIndividualPoints(
  participants: Participant[],
  _config: AppConfig,
): void {
  for (const participant of participants) {
    participant.points = pointsFromPosition(participant.position, participant.status);
  }
}

export const applySideBySideRelayPoints: ApplyRelayPoints = (classes) => {
  for (const classGroup of classes) {
    for (const team of classGroup.teams) {
      const place = team.place ? Number(team.place) : undefined;
      team.points =
        team.completedStageCount === 0
          ? 0
          : pointsFromPosition(place, team.status) * team.teamStageCount;
    }
  }
};
