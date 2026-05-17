import { describe, expect, it } from "vitest";
import { type Participant } from "../io/parse-iof";
import {
  applyMilitaryIndividualPoints,
  MILITARY_OUT_OF_COMPETITION_POINTS,
  militaryIndividualPointsFromPosition,
} from "./military-individual-points";

describe("militaryIndividualPointsFromPosition", () => {
  it("calculates military individual points by position table", () => {
    expect(militaryIndividualPointsFromPosition(1, "OK")).toBe(45);
    expect(militaryIndividualPointsFromPosition(2, "OK")).toBe(42);
    expect(militaryIndividualPointsFromPosition(3, "OK")).toBe(40);
    expect(militaryIndividualPointsFromPosition(4, "OK")).toBe(38);
    expect(militaryIndividualPointsFromPosition(5, "OK")).toBe(36);
    expect(militaryIndividualPointsFromPosition(6, "OK")).toBe(35);
    expect(militaryIndividualPointsFromPosition(7, "OK")).toBe(34);
    expect(militaryIndividualPointsFromPosition(8, "OK")).toBe(33);
    expect(militaryIndividualPointsFromPosition(30, "OK")).toBe(11);
    expect(militaryIndividualPointsFromPosition(40, "OK")).toBe(1);
  });

  it("uses minimum points for missing or non-OK results", () => {
    expect(militaryIndividualPointsFromPosition(undefined, "OK")).toBe(1);
    expect(militaryIndividualPointsFromPosition(1, "DNF")).toBe(1);
    expect(militaryIndividualPointsFromPosition(41, "OK")).toBe(1);
  });

  it("scores military individual places only among filtered organisations", () => {
    const participants: Participant[] = [
      makeParticipant("Other 1", 1),
      makeParticipant("Other 2", 2),
      makeParticipant("Other 3", 3),
      makeParticipant("Other 4", 4),
      makeParticipant("Target Team", 5),
      makeParticipant("Target Team", 6),
    ];

    applyMilitaryIndividualPoints(participants, "^Target");

    expect(participants.slice(0, 4).map((participant) => participant.points)).toEqual([
      0,
      0,
      0,
      0,
    ]);
    expect(participants.slice(0, 4).map((participant) => participant.pointsLabel)).toEqual([
      MILITARY_OUT_OF_COMPETITION_POINTS,
      MILITARY_OUT_OF_COMPETITION_POINTS,
      MILITARY_OUT_OF_COMPETITION_POINTS,
      MILITARY_OUT_OF_COMPETITION_POINTS,
    ]);
    expect(participants[4].points).toBe(45);
    expect(participants[4].pointsLabel).toBe("45");
    expect(participants[5].points).toBe(42);
    expect(participants[5].pointsLabel).toBe("42");
  });
});

function makeParticipant(club: string, position: number): Participant {
  return {
    className: "Ч",
    name: `${club} athlete`,
    club,
    timeSec: 3600 + position,
    position,
    status: "OK",
    points: 0,
  };
}
