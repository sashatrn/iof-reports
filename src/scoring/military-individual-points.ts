import { type AppConfig } from "../config";
import { type Participant } from "../io/parse-iof";

export const MILITARY_OUT_OF_COMPETITION_POINTS = "";

export function militaryIndividualPointsFromPosition(
  position: number | undefined,
  status: string,
): number {
  if (status !== "OK" || position === undefined) return 0;

  if (position === 1) return 45;
  if (position === 2) return 42;
  if (position === 3) return 40;
  if (position === 4) return 38;

  const points = 41 - position;
  return points > 1 ? points : 1;
}

export function buildMilitaryTeamFilter(teamFilterRegex: string): RegExp {
  try {
    return new RegExp(teamFilterRegex);
  } catch (error) {
    throw new Error(`Invalid military.teamFilterRegex: ${(error as Error).message}`);
  }
}

export function buildMilitaryClassFilter(classFilterRegex: string): RegExp {
  try {
    return new RegExp(classFilterRegex);
  } catch (error) {
    throw new Error(`Invalid military.classFilterRegex: ${(error as Error).message}`);
  }
}

function sortByResult(left: Participant, right: Participant): number {
  const positionDiff = (left.position ?? 9999) - (right.position ?? 9999);

  if (positionDiff !== 0) {
    return positionDiff;
  }

  const timeDiff =
    (left.timeSec ?? Number.MAX_SAFE_INTEGER) - (right.timeSec ?? Number.MAX_SAFE_INTEGER);

  if (timeDiff !== 0) {
    return timeDiff;
  }

  return left.name.localeCompare(right.name, "uk");
}

export function applyMilitaryIndividualPoints(
  participants: Participant[],
  teamFilterRegex: string,
  classFilterRegex = ".*",
): void {
  const teamFilter = buildMilitaryTeamFilter(teamFilterRegex);
  const classFilter = buildMilitaryClassFilter(classFilterRegex);
  const byClass = new Map<string, Participant[]>();

  for (const participant of participants) {
    const classParticipants = byClass.get(participant.className) ?? [];
    classParticipants.push(participant);
    byClass.set(participant.className, classParticipants);
  }

  for (const classParticipants of byClass.values()) {
    if (!classFilter.test(classParticipants[0]?.className ?? "")) {
      for (const participant of classParticipants) {
        participant.points = 0;
        participant.pointsLabel = MILITARY_OUT_OF_COMPETITION_POINTS;
      }

      continue;
    }

    let scoredCount = 0;
    let previousOfficialPosition: number | undefined;
    let currentScoringPosition = 0;

    for (const participant of [...classParticipants].sort(sortByResult)) {
      if (!teamFilter.test(participant.club)) {
        participant.points = 0;
        participant.pointsLabel = MILITARY_OUT_OF_COMPETITION_POINTS;
        continue;
      }

      if (participant.status === "OK" && participant.position !== undefined) {
        if (participant.position !== previousOfficialPosition) {
          currentScoringPosition = scoredCount + 1;
          previousOfficialPosition = participant.position;
        }

        scoredCount += 1;
        participant.points = militaryIndividualPointsFromPosition(
          currentScoringPosition,
          participant.status,
        );
        participant.pointsLabel = String(participant.points);
        continue;
      }

      participant.points = militaryIndividualPointsFromPosition(undefined, participant.status);
      participant.pointsLabel = String(participant.points);
    }
  }
}

export function applyMilitaryIndividualPointsFromConfig(
  participants: Participant[],
  config: AppConfig,
): void {
  applyMilitaryIndividualPoints(
    participants,
    config.military.teamFilterRegex,
    config.military.classFilterRegex,
  );
}
