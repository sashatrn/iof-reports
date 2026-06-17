import fs from "fs";
import path from "path";
import { Logger } from "pino";
import { isSingleReportType, SingleReportType } from "../report-types";

export type WatchReportType = SingleReportType;

export type WatchOptions = {
  inputDir: string;
  outputDir: string;
  configPath?: string;
  courseDataPath?: string;
  reportType: SingleReportType;
  requestedReportType: WatchReportType;
  pollMs: number;
  settleMs: number;
  port: number;
  awards: boolean;
  diplomaTemplate: "off" | "on";
};

function printUsage(logger: Logger): void {
  logger.info(
    "Usage: node dist/index.js watch --input-dir <dir> --output-dir <dir> --report <individual|individual-rogaining|team|side-by-side-rogaining|relay|rogaining|rogaining-diplomas|rogaining-score|rogaining-splits> [--awards] [--config config.json] [--courses courses.xml] [--poll-ms 3000] [--settle-ms 1000] [--port 4173] [--diploma-template off|on]",
  );
}

function isWatchReportType(value: string): value is WatchReportType {
  return isSingleReportType(value);
}

export function parseWatchArgs(argv: string[], logger: Logger): WatchOptions {
  let inputDir = "";
  let outputDir = "";
  let configPath: string | undefined;
  let courseDataPath: string | undefined;
  let reportType: SingleReportType | undefined;
  let requestedReportType: WatchReportType | undefined;
  let pollMs = 3000;
  let settleMs = 1000;
  let port = 4173;
  let awards = false;
  let diplomaTemplate: WatchOptions["diplomaTemplate"] = "off";

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

    if (arg === "--config" || arg === "-c") {
      if (!value || value.startsWith("-")) {
        logger.error("No config file provided for --config.");
        printUsage(logger);
        process.exit(1);
      }

      configPath = path.resolve(process.cwd(), value);
      i += 1;
      continue;
    }

    if (arg === "--report") {
      if (!value || !isWatchReportType(value)) {
        logger.error(
          { report: value },
          "Invalid watch report type. Expected one of: individual, individual-rogaining, team, side-by-side-rogaining, relay, rogaining, rogaining-diplomas, rogaining-score, rogaining-splits.",
        );
        printUsage(logger);
        process.exit(1);
      }

      if (
        value === "rogaining-results" ||
        value === "rogaining-results-score" ||
        value === "summary" ||
        value === "summary-team"
      ) {
        logger.error(`${value} is not supported in watch mode yet. Use the regular CLI with the required companion XML file.`);
        printUsage(logger);
        process.exit(1);
      }

      reportType = value;
      requestedReportType = value;
      i += 1;
      continue;
    }

    if (arg === "--awards") {
      awards = true;
      continue;
    }

    if (arg === "--courses" || arg === "--course") {
      if (!value) {
        logger.error("No CourseData XML file provided for --courses.");
        printUsage(logger);
        process.exit(1);
      }

      courseDataPath = path.resolve(process.cwd(), value);
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

    if (arg === "--diploma-template") {
      if (value !== "off" && value !== "on") {
        logger.error(
          { diplomaTemplate: value },
          "diploma-template must be one of: off, on.",
        );
        printUsage(logger);
        process.exit(1);
      }

      diplomaTemplate = value;
      i += 1;
      continue;
    }

    logger.error({ arg }, "Unknown watch argument.");
    printUsage(logger);
    process.exit(1);
  }

  if (!inputDir || !outputDir || !reportType || !requestedReportType) {
    logger.error("Missing required watch arguments.");
    printUsage(logger);
    process.exit(1);
  }

  if (!fs.existsSync(inputDir) || !fs.statSync(inputDir).isDirectory()) {
    logger.error({ inputDir }, "Input directory not found.");
    process.exit(1);
  }

  if (configPath && !fs.existsSync(configPath)) {
    logger.error({ path: configPath }, "Config file not found.");
    process.exit(1);
  }

  if (courseDataPath && !fs.existsSync(courseDataPath)) {
    logger.error({ path: courseDataPath }, "CourseData XML file not found.");
    process.exit(1);
  }

  if (reportType === "rogaining-splits" && !courseDataPath) {
    logger.error("rogaining-splits report requires --courses <courses.xml>.");
    printUsage(logger);
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
    configPath,
    courseDataPath,
    reportType,
    requestedReportType,
    pollMs,
    settleMs,
    port,
    awards,
    diplomaTemplate,
  };
}
