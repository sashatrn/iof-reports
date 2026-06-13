import fs from "fs";
import os from "os";
import path from "path";
import { Logger } from "pino";
import { describe, expect, it } from "vitest";
import { parseCliArgs } from "./cli";

function testLogger(): Logger {
  return {
    error: () => undefined,
    info: () => undefined,
  } as unknown as Logger;
}

describe("parseCliArgs", () => {
  it("accepts summary-team series inputs without a positional XML", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "iof-series-"));
    const individualPath = path.join(tempDir, "individual.xml");
    const rogainingPath = path.join(tempDir, "choice.xml");
    const relayPath = path.join(tempDir, "relay.xml");

    fs.writeFileSync(individualPath, "<ResultList />");
    fs.writeFileSync(rogainingPath, "<ResultList />");
    fs.writeFileSync(relayPath, "<ResultList />");

    const options = parseCliArgs(
      [
        "node",
        "dist/index.js",
        "--report",
        "summary-team",
        "--series",
        `individual=${individualPath}`,
        "--series",
        `rogaining=${rogainingPath}`,
        "--series",
        `relay=${relayPath}`,
      ],
      testLogger(),
    );

    expect(options.inputPath).toBe(individualPath);
    expect(options.seriesInputPaths).toEqual([
      { type: "individual", path: individualPath },
      { type: "side-by-side-rogaining", path: rogainingPath },
      { type: "relay", path: relayPath },
    ]);

    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
