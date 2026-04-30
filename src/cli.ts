import fs from "fs";
import path from "path";
import { Logger } from "pino";
import { ReportType, REPORT_TYPES } from "./report-types";

export type CliOptions = {
  inputPath: string;
  configPath?: string;
  courseDataPath?: string;
  report: ReportType;
  format: "pdf" | "docx";
  html: "none" | "view" | "pdf";
  diplomaTemplate: "off" | "on";
};

const REPORT_VALUES = new Set<string>(REPORT_TYPES);
const HTML_VALUES = new Set<string>(["none", "view", "pdf"]);
const FORMAT_VALUES = new Set<string>(["pdf", "docx"]);
const DIPLOMA_TEMPLATE_VALUES = new Set<string>(["off", "on"]);

function printUsage(logger: Logger): void {
  logger.info(
    "Usage: node dist/index.js <file.xml> [--config config.json] [--report all|individual|team|rogaining|rogaining-awards|rogaining-diplomas|rogaining-score|rogaining-splits] [--format pdf|docx] [--courses courses.xml] [--html none|view|pdf] [--diploma-template off|on]",
  );
}

export function extractConfigPathArg(argv: string[]): string | undefined {
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg !== "--config" && arg !== "-c") {
      continue;
    }

    const value = argv[i + 1];

    if (!value || value.startsWith("-")) {
      throw new Error("No config file provided for --config.");
    }

    return path.resolve(process.cwd(), value);
  }

  return undefined;
}

export function parseCliArgs(argv: string[], logger: Logger): CliOptions {
  let input: string | undefined;
  let report: CliOptions["report"] = "all";
  let configPath: string | undefined;
  let courseDataPath: string | undefined;
  let format: CliOptions["format"] = "pdf";
  let html: CliOptions["html"] = "none";
  let diplomaTemplate: CliOptions["diplomaTemplate"] = "off";

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];

    if (!arg.startsWith("-")) {
      if (!input) {
        input = arg;
        continue;
      }

      logger.error({ arg }, "Unexpected positional argument.");
      printUsage(logger);
      process.exit(1);
    }

    if (arg === "--report" || arg === "-r") {
      const value = argv[i + 1];

      if (!value || !REPORT_VALUES.has(value)) {
        logger.error(
          { report: value },
          "Invalid report type. Expected one of: all, individual, team, rogaining, rogaining-awards, rogaining-diplomas, rogaining-score, rogaining-splits.",
        );
        printUsage(logger);
        process.exit(1);
      }

      report = value as CliOptions["report"];
      i += 1;
      continue;
    }

    if (arg === "--config" || arg === "-c") {
      const value = argv[i + 1];

      if (!value || value.startsWith("-")) {
        logger.error("No config file provided for --config.");
        printUsage(logger);
        process.exit(1);
      }

      configPath = path.resolve(process.cwd(), value);
      i += 1;
      continue;
    }

    if (arg === "--courses" || arg === "--course") {
      const value = argv[i + 1];

      if (!value) {
        logger.error("No CourseData XML file provided for --courses.");
        printUsage(logger);
        process.exit(1);
      }

      courseDataPath = path.resolve(process.cwd(), value);
      i += 1;
      continue;
    }

    if (arg === "--html") {
      const value = argv[i + 1];

      if (!value || !HTML_VALUES.has(value)) {
        logger.error(
          { html: value },
          "Invalid html mode. Expected one of: none, view, pdf.",
        );
        printUsage(logger);
        process.exit(1);
      }

      html = value as CliOptions["html"];
      i += 1;
      continue;
    }

    if (arg === "--format") {
      const value = argv[i + 1];

      if (!value || !FORMAT_VALUES.has(value)) {
        logger.error(
          { format: value },
          "Invalid format. Expected one of: pdf, docx.",
        );
        printUsage(logger);
        process.exit(1);
      }

      format = value as CliOptions["format"];
      i += 1;
      continue;
    }

    if (arg === "--diploma-template") {
      const value = argv[i + 1];

      if (!value || !DIPLOMA_TEMPLATE_VALUES.has(value)) {
        logger.error(
          { diplomaTemplate: value },
          "Invalid diploma template mode. Expected one of: off, on.",
        );
        printUsage(logger);
        process.exit(1);
      }

      diplomaTemplate = value as CliOptions["diplomaTemplate"];
      i += 1;
      continue;
    }

    logger.error({ arg }, "Unknown CLI argument.");
    printUsage(logger);
    process.exit(1);
  }

  if (!input) {
    logger.error("No XML file provided.");
    printUsage(logger);
    process.exit(1);
  }

  const absolutePath = path.resolve(process.cwd(), input);

  if (!fs.existsSync(absolutePath)) {
    logger.error({ path: absolutePath }, "XML file not found.");
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

  if (report === "rogaining-splits" && !courseDataPath) {
    logger.error("rogaining-splits report requires --courses <courses.xml>.");
    printUsage(logger);
    process.exit(1);
  }

  return {
    inputPath: absolutePath,
    configPath,
    courseDataPath,
    report,
    format,
    html,
    diplomaTemplate,
  };
}
