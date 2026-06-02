import { Participant } from "../io/parse-iof";
import { RogainingTeam } from "../io/parse-rogaining-iof";

const PDF_HIDDEN_STATUSES = new Set(["Active", "Inactive"]);

export function isPdfVisibleStatus(status: string | undefined): boolean {
  return status === undefined || !PDF_HIDDEN_STATUSES.has(status);
}

export function isPdfVisibleParticipant(participant: Participant): boolean {
  return isPdfVisibleStatus(participant.status);
}

export function isPdfVisibleTeam(team: RogainingTeam): boolean {
  return isPdfVisibleStatus(team.status);
}

export function isPdfVisibleRelayTeam(team: RogainingTeam): boolean {
  return (
    isPdfVisibleTeam(team) &&
    !team.memberStatuses?.some((status) => !isPdfVisibleStatus(status))
  );
}
