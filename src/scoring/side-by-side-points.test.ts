import { describe, expect, it } from "vitest";
import { pointsFromPosition } from "./side-by-side-points";

describe("pointsFromPosition", () => {
  it("does not score active and inactive side-by-side participants", () => {
    expect(pointsFromPosition(undefined, "Active")).toBe(0);
    expect(pointsFromPosition(1, "Active")).toBe(0);
    expect(pointsFromPosition(undefined, "Inactive")).toBe(0);
    expect(pointsFromPosition(1, "Inactive")).toBe(0);
  });

  it("keeps minimum points for other unplaced side-by-side statuses", () => {
    expect(pointsFromPosition(undefined, "DidNotFinish")).toBe(1);
    expect(pointsFromPosition(undefined, "MissingPunch")).toBe(1);
  });
});
