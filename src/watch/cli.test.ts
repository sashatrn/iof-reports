import fs from "fs";
import os from "os";
import path from "path";
import { Logger } from "pino";
import { describe, expect, it } from "vitest";
import { parseWatchArgs } from "./cli";

function testLogger(): Logger {
  return {
    error: () => undefined,
    info: () => undefined,
  } as unknown as Logger;
}

describe("parseWatchArgs", () => {
  it("accepts side-by-side-individual in watch mode", () => {
    const inputDir = fs.mkdtempSync(path.join(os.tmpdir(), "iof-watch-input-"));
    const outputDir = path.join(os.tmpdir(), "iof-watch-output");

    const options = parseWatchArgs(
      [
        "node",
        "dist/index.js",
        "watch",
        "--input-dir",
        inputDir,
        "--output-dir",
        outputDir,
        "--report",
        "side-by-side-individual",
      ],
      testLogger(),
    );

    expect(options.reportType).toBe("side-by-side-individual");
    expect(options.requestedReportType).toBe("side-by-side-individual");
  });

  it("accepts side-by-side-relay in watch mode", () => {
    const inputDir = fs.mkdtempSync(path.join(os.tmpdir(), "iof-watch-input-"));
    const outputDir = path.join(os.tmpdir(), "iof-watch-output");

    const options = parseWatchArgs(
      [
        "node",
        "dist/index.js",
        "watch",
        "--input-dir",
        inputDir,
        "--output-dir",
        outputDir,
        "--report",
        "side-by-side-relay",
      ],
      testLogger(),
    );

    expect(options.reportType).toBe("side-by-side-relay");
    expect(options.requestedReportType).toBe("side-by-side-relay");
  });

  it("accepts side-by-side-rogaining in watch mode", () => {
    const inputDir = fs.mkdtempSync(path.join(os.tmpdir(), "iof-watch-input-"));
    const outputDir = path.join(os.tmpdir(), "iof-watch-output");

    const options = parseWatchArgs(
      [
        "node",
        "dist/index.js",
        "watch",
        "--input-dir",
        inputDir,
        "--output-dir",
        outputDir,
        "--report",
        "side-by-side-rogaining",
      ],
      testLogger(),
    );

    expect(options.reportType).toBe("side-by-side-rogaining");
    expect(options.requestedReportType).toBe("side-by-side-rogaining");
  });

  it("accepts side-by-side-summary companion files in watch mode", () => {
    const inputDir = fs.mkdtempSync(path.join(os.tmpdir(), "iof-watch-input-"));
    const outputDir = path.join(os.tmpdir(), "iof-watch-output");
    const rogainingPath = path.join(inputDir, "choice.xml");
    const relayPath = path.join(inputDir, "relay.xml");

    fs.writeFileSync(rogainingPath, "<ResultList />");
    fs.writeFileSync(relayPath, "<ResultList />");

    const options = parseWatchArgs(
      [
        "node",
        "dist/index.js",
        "watch",
        "--input-dir",
        inputDir,
        "--output-dir",
        outputDir,
        "--report",
        "side-by-side-summary",
        "--rogaining",
        rogainingPath,
        "--relay",
        relayPath,
      ],
      testLogger(),
    );

    expect(options.reportType).toBe("side-by-side-summary");
    expect(options.rogainingInputPath).toBe(rogainingPath);
    expect(options.relayInputPath).toBe(relayPath);
  });
});
