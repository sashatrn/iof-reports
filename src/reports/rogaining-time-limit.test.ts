import { describe, expect, it } from "vitest";
import { loadConfig } from "../config";
import { applyRogainingTimeLimit } from "./rogaining-time-limit";

function configWithTimeLimit(controlTime: string, allowedOvertime: string) {
  const config = loadConfig();

  return {
    ...config,
    rogaining: {
      ...config.rogaining,
      controlTime,
      allowedOvertime,
    },
  };
}

describe("applyRogainingTimeLimit", () => {
  it("disqualifies only OK results above the configured maximum time", () => {
    const config = configWithTimeLimit("01:00:00", "00:10:00");
    const results = applyRogainingTimeLimit(
      [
        { name: "Before", status: "OK", timeSec: 4199 },
        { name: "At limit", status: "OK", timeSec: 4200 },
        { name: "Over limit", status: "OK", timeSec: 4201 },
        { name: "Already DNF", status: "DidNotFinish", timeSec: 5000 },
      ],
      config,
    );

    expect(results.map((result) => result.status)).toEqual([
      "OK",
      "OK",
      "OverTime",
      "DidNotFinish",
    ]);
  });

  it("supports hours above 23", () => {
    const config = configWithTimeLimit("24:00:00", "01:00:00");
    const results = applyRogainingTimeLimit(
      [{ status: "OK", timeSec: 25 * 3600 }],
      config,
    );

    expect(results[0].status).toBe("OK");
  });

  it("rejects invalid duration configuration", () => {
    const config = configWithTimeLimit("1:00", "00:10:00");

    expect(() => applyRogainingTimeLimit([], config)).toThrow(
      'Invalid rogaining.controlTime "1:00". Expected чч:мм:сс.',
    );
  });
});
