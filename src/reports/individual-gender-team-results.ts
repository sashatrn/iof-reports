import { type AppConfig } from "../config";
import { Participant } from "../io/parse-iof";
import {
  computeTeamResults,
  type GenderTeamResult,
} from "../scoring/side-by-side-team";
import { type Logger } from "pino";

export type GenderIndividualTeamResults = {
  men: GenderTeamResult[];
  women: GenderTeamResult[];
};

export function buildGenderIndividualTeamResults(
  participants: Participant[],
  config: AppConfig,
  logger?: Logger,
): GenderIndividualTeamResults {
  return computeTeamResults(participants, config, logger);
}
