import { describe, expect, it } from "vitest";
import { militaryRelayPointsFromPlace } from "./military-relay-points";

describe("militaryRelayPointsFromPlace", () => {
  it("calculates military relay points by team place table", () => {
    expect(militaryRelayPointsFromPlace(1, "OK")).toBe(126);
    expect(militaryRelayPointsFromPlace(2, "OK")).toBe(111);
    expect(militaryRelayPointsFromPlace(3, "OK")).toBe(99);
    expect(militaryRelayPointsFromPlace(4, "OK")).toBe(90);
    expect(militaryRelayPointsFromPlace(5, "OK")).toBe(81);
    expect(militaryRelayPointsFromPlace(6, "OK")).toBe(72);
    expect(militaryRelayPointsFromPlace(7, "OK")).toBe(63);
    expect(militaryRelayPointsFromPlace(8, "OK")).toBe(54);
    expect(militaryRelayPointsFromPlace(9, "OK")).toBe(45);
    expect(militaryRelayPointsFromPlace(10, "OK")).toBe(36);
  });

  it("uses zero points outside the table or for non-OK results", () => {
    expect(militaryRelayPointsFromPlace(undefined, "OK")).toBe(0);
    expect(militaryRelayPointsFromPlace(1, "DNF")).toBe(0);
    expect(militaryRelayPointsFromPlace(11, "OK")).toBe(0);
  });
});
