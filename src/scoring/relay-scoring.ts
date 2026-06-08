import { type AppConfig, type RelayScoringType } from "../config";
import { applyMilitaryRelayPoints } from "./military-relay-points";
import { applySideBySideRelayPoints } from "./side-by-side-points";

export type RelayScoringEntry = {
  place: string;
  sourceClassName: string;
  organisation: string;
  status: string;
  completedStageCount: number;
  teamStageCount: number;
  points: number;
};

export type RelayScoringClass = {
  name: string;
  teams: RelayScoringEntry[];
};

export type ApplyRelayPoints = (classes: RelayScoringClass[], config: AppConfig) => void;

export type RelayScoring = {
  type: RelayScoringType;
  applyPoints: ApplyRelayPoints;
};

const relayScoringByType: Record<RelayScoringType, RelayScoring> = {
  "side-by-side": {
    type: "side-by-side",
    applyPoints: applySideBySideRelayPoints,
  },
  military: {
    type: "military",
    applyPoints: applyMilitaryRelayPoints,
  },
};

export function getRelayScoring(type: RelayScoringType): RelayScoring {
  const scoring = relayScoringByType[type];

  if (!scoring) {
    throw new Error(
      `Invalid relay.scoring "${type}". Expected side-by-side or military.`,
    );
  }

  return scoring;
}
