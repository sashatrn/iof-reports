import { describe, expect, it } from "vitest";
import { getRelayScoring } from "./relay-scoring";

describe("getRelayScoring", () => {
  it("resolves relay scoring aliases", () => {
    expect(getRelayScoring("side-by-side").type).toBe("side-by-side");
    expect(getRelayScoring("military").type).toBe("military");
  });

  it("reports invalid relay scoring values", () => {
    expect(() => getRelayScoring("unknown" as "military")).toThrow(
      'Invalid relay.scoring "unknown". Expected side-by-side or military.',
    );
  });
});
