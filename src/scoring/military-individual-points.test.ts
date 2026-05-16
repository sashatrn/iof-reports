import { describe, expect, it } from "vitest";
import { militaryIndividualPointsFromPosition } from "./military-individual-points";

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
});
