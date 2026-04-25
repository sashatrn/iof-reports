import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { parseRogainingIof } from "./parse-rogaining-iof";

const rogainingXml = fs.readFileSync(
  path.resolve(__dirname, "../__fixtures__/rogaining-test.xml"),
  "utf-8",
);

describe("parseRogainingIof", () => {
  it("treats Score as already final and does not subtract penalty twice", () => {
    const parsed = parseRogainingIof(rogainingXml);
    const team = parsed.teams.find((entry) => entry.teamName === "Тотус");

    expect(team).toBeDefined();
    expect(team?.score).toBe(84);
    expect(team?.penalty).toBe(2);
    expect(team?.totalScore).toBe(84);
  });
});
