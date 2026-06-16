import fs from "fs";
import os from "os";
import path from "path";
import { Logger } from "pino";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseWatchArgs } from "./cli";

function testLogger(): Logger {
  return {
    error: () => undefined,
    info: () => undefined,
  } as unknown as Logger;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("parseWatchArgs", () => {
  it("accepts individual in watch mode", () => {
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
        "individual",
      ],
      testLogger(),
    );

    expect(options.reportType).toBe("individual");
    expect(options.requestedReportType).toBe("individual");
  });

  it("accepts relay in watch mode", () => {
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
        "relay",
      ],
      testLogger(),
    );

    expect(options.reportType).toBe("relay");
    expect(options.requestedReportType).toBe("relay");
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

  it("accepts individual-rogaining in watch mode", () => {
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
        "individual-rogaining",
      ],
      testLogger(),
    );

    expect(options.reportType).toBe("individual-rogaining");
    expect(options.requestedReportType).toBe("individual-rogaining");
  });

  it("accepts awards mode in watch mode", () => {
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
        "rogaining",
        "--awards",
      ],
      testLogger(),
    );

    expect(options.awards).toBe(true);
  });

  it("rejects summary-team in watch mode", () => {
    const inputDir = fs.mkdtempSync(path.join(os.tmpdir(), "iof-watch-input-"));
    const outputDir = path.join(os.tmpdir(), "iof-watch-output");
    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((() => {
        throw new Error("process.exit");
      }) as never);

    expect(() =>
      parseWatchArgs(
        [
          "node",
          "dist/index.js",
          "watch",
          "--input-dir",
          inputDir,
          "--output-dir",
          outputDir,
          "--report",
          "summary-team",
        ],
        testLogger(),
      ),
    ).toThrow("process.exit");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
