import { Participant } from "../io/parse-iof";
import { TeamIofTeam } from "../io/parse-team-iof";

const PDF_HIDDEN_STATUSES = new Set(["Active", "Inactive"]);

export function isPdfVisibleStatus(status: string | undefined): boolean {
  return status === undefined || !PDF_HIDDEN_STATUSES.has(status);
}

export function isPdfVisibleParticipant(participant: Participant): boolean {
  return isPdfVisibleStatus(participant.status);
}

export function isPdfVisibleTeam(team: TeamIofTeam): boolean {
  return isPdfVisibleStatus(team.status);
}

export function isPdfVisibleRelayTeam(team: TeamIofTeam): boolean {
  return (
    isPdfVisibleTeam(team) &&
    !team.memberStatuses?.some((status) => !isPdfVisibleStatus(status))
  );
}
