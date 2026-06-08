import { describe, expect, it } from "vitest";
import { type AppConfig } from "../config";
import { type Participant } from "../io/parse-iof";
import { applyRegularIndividualPoints } from "./regular-individual-points";

describe("applyRegularIndividualPoints", () => {
  it("calculates rounded points from the leader time within each class", () => {
    const participants = [
      makeParticipant("M21", "Leader", 600),
      makeParticipant("M21", "Second", 750),
      makeParticipant("M21", "Rounded", 667),
      makeParticipant("W21", "Other class leader", 900),
    ];

    applyRegularIndividualPoints(participants, {} as AppConfig);

    expect(participants.map((participant) => participant.points)).toEqual([
      1000,
      800,
      900,
      1000,
    ]);
  });

  it("does not score non-OK participants or participants without a valid time", () => {
    const participants = [
      makeParticipant("M21", "Leader", 600),
      makeParticipant("M21", "Missing punch", 500, "MissingPunch"),
      makeParticipant("M21", "No time", undefined),
      makeParticipant("M21", "Zero time", 0),
    ];

    applyRegularIndividualPoints(participants, {} as AppConfig);

    expect(participants.map((participant) => participant.points)).toEqual([
      1000,
      0,
      0,
      0,
    ]);
  });
});

function makeParticipant(
  className: string,
  name: string,
  timeSec: number | undefined,
  status = "OK",
): Participant {
  return {
    className,
    name,
    club: "Club",
    timeSec,
    status,
    points: 0,
  };
}
