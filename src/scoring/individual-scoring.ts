import { type AppConfig, type IndividualScoringType } from "../config";
import { type Participant } from "../io/parse-iof";
import { applyMilitaryIndividualPointsFromConfig } from "./military-individual-points";
import { applyRegularIndividualPoints } from "./regular-individual-points";
import { applySideBySideIndividualPoints } from "./side-by-side-points";

export type ApplyIndividualPoints = (
  participants: Participant[],
  config: AppConfig,
) => void;

export type IndividualScoring = {
  type: IndividualScoringType;
  applyPoints: ApplyIndividualPoints;
};

const individualScoringByType: Record<IndividualScoringType, IndividualScoring> = {
  regular: {
    type: "regular",
    applyPoints: applyRegularIndividualPoints,
  },
  "side-by-side": {
    type: "side-by-side",
    applyPoints: applySideBySideIndividualPoints,
  },
  military: {
    type: "military",
    applyPoints: applyMilitaryIndividualPointsFromConfig,
  },
};

export function getIndividualScoring(type: IndividualScoringType): IndividualScoring {
  const scoring = individualScoringByType[type];

  if (!scoring) {
    throw new Error(
      `Invalid individual.scoring "${type}". Expected regular, side-by-side, or military.`,
    );
  }

  return scoring;
}
