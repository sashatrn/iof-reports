import fs from "fs";
import path from "path";
import { Logger } from "pino";
import { isSingleReportType, SingleReportType } from "../report-types";

export type WatchOptions = {
  inputDir: string;
  outputDir: string;
  reportType: SingleReportType;
  pollMs: number;
  settleMs: number;
  port: number;
};

function printUsage(logger: Logger): void {
  logger.info(
    "Usage: node dist/index.js watch --input-dir <dir> --output-dir <dir> --report <individual|team|rogaining|rogaining-awards> [--poll-ms 3000] [--settle-ms 1000] [--port 4173]",
  );
}

export function parseWatchArgs(argv: string[], logger: Logger): WatchOptions {
  let inputDir = "";
  let outputDir = "";
  let reportType: SingleReportType | undefined;
  let pollMs = 3000;
  let settleMs = 1000;
  let port = 4173;

  for (let i = 3; i < argv.length; i += 1) {
    const arg = argv[i];
    const value = argv[i + 1];

    if (arg === "--input-dir") {
      inputDir = path.resolve(process.cwd(), value ?? "");
      i += 1;
      continue;
    }

    if (arg === "--output-dir") {
      outputDir = path.resolve(process.cwd(), value ?? "");
      i += 1;
      continue;
    }

    if (arg === "--report") {
      if (!value || !isSingleReportType(value)) {
        logger.error(
          { report: value },
          "Invalid watch report type. Expected one of: individual, team, rogaining, rogaining-awards.",
        );
        printUsage(logger);
        process.exit(1);
      }

      reportType = value;
      i += 1;
      continue;
    }

    if (arg === "--poll-ms") {
      pollMs = Number(value);
      i += 1;
      continue;
    }

    if (arg === "--settle-ms") {
      settleMs = Number(value);
      i += 1;
      continue;
    }

    if (arg === "--port") {
      port = Number(value);
      i += 1;
      continue;
    }

    logger.error({ arg }, "Unknown watch argument.");
    printUsage(logger);
    process.exit(1);
  }

  if (!inputDir || !outputDir || !reportType) {
    logger.error("Missing required watch arguments.");
    printUsage(logger);
    process.exit(1);
  }

  if (!fs.existsSync(inputDir) || !fs.statSync(inputDir).isDirectory()) {
    logger.error({ inputDir }, "Input directory not found.");
    process.exit(1);
  }

  if (!Number.isFinite(pollMs) || pollMs < 500) {
    logger.error({ pollMs }, "poll-ms must be a number >= 500.");
    process.exit(1);
  }

  if (!Number.isFinite(settleMs) || settleMs < 0) {
    logger.error({ settleMs }, "settle-ms must be a number >= 0.");
    process.exit(1);
  }

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    logger.error({ port }, "port must be an integer between 1 and 65535.");
    process.exit(1);
  }

  return {
    inputDir,
    outputDir,
    reportType,
    pollMs,
    settleMs,
    port,
  };
}
