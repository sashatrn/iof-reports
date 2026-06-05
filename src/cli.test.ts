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
  it("accepts side-by-side summary series inputs without a positional XML", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "iof-series-"));
    const individualPath = path.join(tempDir, "individual.xml");
    const relayPath = path.join(tempDir, "relay.xml");

    fs.writeFileSync(individualPath, "<ResultList />");
    fs.writeFileSync(relayPath, "<ResultList />");

    const options = parseCliArgs(
      [
        "node",
        "dist/index.js",
        "--report",
        "side-by-side-summary",
        "--series",
        `individual=${individualPath}`,
        "--series",
        `relay=${relayPath}`,
      ],
      testLogger(),
    );

    expect(options.inputPath).toBe(individualPath);
    expect(options.seriesInputPaths).toEqual([
      { type: "individual", path: individualPath },
      { type: "relay", path: relayPath },
    ]);

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("accepts companion rogaining and relay files for side-by-side summary", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "iof-summary-"));
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
        individualPath,
        "--report",
        "side-by-side-summary",
        "--rogaining",
        rogainingPath,
        "--relay",
        relayPath,
      ],
      testLogger(),
    );

    expect(options.rogainingInputPath).toBe(rogainingPath);
    expect(options.relayInputPath).toBe(relayPath);

    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
