import { type Logger } from "pino";
import { type AppConfig } from "../config";
import { type Participant } from "../io/parse-iof";
import { type SummaryTeamSourceGroup } from "../scoring/summary-team";
import { type GenderTeamResult } from "../scoring/side-by-side-team";
import { buildGenderIndividualTeamResults } from "./individual-gender-team-results";
import { buildGroupedIndividualTeamResults } from "./individual-team-results";
import {
  buildFlatRelayTeamResults,
  buildGroupedRelayTeamResults,
  type RelayClass,
} from "./relay-report";
import {
  buildSideBySideRogainingTeamResults,
  type SideBySideRogainingClass,
} from "./side-by-side-rogaining-report";

export type SummaryTeamSourceType =
  | "individual"
  | "relay"
  | "side-by-side-rogaining";

function mergeGenderResults(
  results: GenderTeamResult[],
): Array<{ organisation: string; points: number }> {
  return results.map((result) => ({
    organisation: result.club,
    points: result.points,
  }));
}

export function buildIndividualSummaryTeamGroups(
  participants: Participant[],
  config: AppConfig,
  logger?: Logger,
): SummaryTeamSourceGroup[] {
  if (config.individual.teamResults === "grouped") {
    return buildGroupedIndividualTeamResults(
      participants,
      config.individual.teamFilterRegex,
      config.individual.classFilterRegex,
      config.individual.classOrderGroups,
    ).map((group) => ({
      name: group.name,
      results: group.teams,
    }));
  }

  if (config.individual.teamResults === "gender") {
    const teamResults = buildGenderIndividualTeamResults(participants, config, logger);

    return [{
      results: [
        ...mergeGenderResults(teamResults.men),
        ...mergeGenderResults(teamResults.women),
      ],
    }];
  }

  return [];
}

export function buildRelaySummaryTeamGroups(
  classes: RelayClass[],
  config: AppConfig,
): SummaryTeamSourceGroup[] {
  if (config.relay.teamResults === "grouped") {
    return buildGroupedRelayTeamResults(classes, config).map((group) => ({
      name: group.name,
      results: group.teams,
    }));
  }

  if (config.relay.teamResults === "flat") {
    return [{ results: buildFlatRelayTeamResults(classes) }];
  }

  return [];
}

export function buildRogainingSummaryTeamGroups(
  classes: SideBySideRogainingClass[],
): SummaryTeamSourceGroup[] {
  return [{ results: buildSideBySideRogainingTeamResults(classes) }];
}
