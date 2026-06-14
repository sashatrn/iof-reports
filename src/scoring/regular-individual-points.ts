import { type AppConfig } from "../config";
import { type Participant } from "../io/parse-iof";

const SCORE_BASE = 1000;

export function applyRegularIndividualPoints(
  participants: Participant[],
  _config: AppConfig,
): void {
  const leaderTimeByClass = new Map<string, number>();

  for (const participant of participants) {
    if (
      participant.status !== "OK" ||
      participant.timeSec === undefined ||
      participant.timeSec <= 0
    ) {
      continue;
    }

    const leaderTime = leaderTimeByClass.get(participant.className);

    if (leaderTime === undefined || participant.timeSec < leaderTime) {
      leaderTimeByClass.set(participant.className, participant.timeSec);
    }
  }

  for (const participant of participants) {
    const leaderTime = leaderTimeByClass.get(participant.className);

    participant.points =
      participant.status === "OK" &&
      participant.timeSec !== undefined &&
      participant.timeSec > 0 &&
      leaderTime !== undefined
        ? Math.round((SCORE_BASE * leaderTime) / participant.timeSec)
        : 0;
  }
}
