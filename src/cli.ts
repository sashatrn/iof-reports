import fs from "fs";
import path from "path";
import { Logger } from "pino";
import { ReportType, REPORT_TYPES } from "./report-types";

export type CliOptions = {
  inputPath: string;
  report: ReportType;
  html: "none" | "view" | "pdf" | "both";
  diplomaTemplate: "off" | "on";
};

const REPORT_VALUES = new Set<string>(REPORT_TYPES);
const HTML_VALUES = new Set<string>(["none", "view", "pdf", "both"]);
const DIPLOMA_TEMPLATE_VALUES = new Set<string>(["off", "on"]);

function printUsage(logger: Logger): void {
  logger.info(
    "Usage: node dist/index.js <file.xml> [--report all|individual|team|rogaining|rogaining-awards|rogaining-diplomas|rogaining-score] [--html none|view|pdf|both] [--diploma-template off|on]",
  );
}

export function parseCliArgs(argv: string[], logger: Logger): CliOptions {
  const input = argv[2];

  if (!input) {
    logger.error("No XML file provided.");
    printUsage(logger);
    process.exit(1);
  }

  let report: CliOptions["report"] = "all";
  let html: CliOptions["html"] = "none";
  let diplomaTemplate: CliOptions["diplomaTemplate"] = "off";

  for (let i = 3; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--report" || arg === "-r") {
      const value = argv[i + 1];

      if (!value || !REPORT_VALUES.has(value)) {
        logger.error(
          { report: value },
          "Invalid report type. Expected one of: all, individual, team, rogaining, rogaining-awards, rogaining-diplomas, rogaining-score.",
        );
        printUsage(logger);
        process.exit(1);
      }

      report = value as CliOptions["report"];
      i += 1;
      continue;
    }

    if (arg === "--html") {
      const value = argv[i + 1];

      if (!value || !HTML_VALUES.has(value)) {
        logger.error(
          { html: value },
          "Invalid html mode. Expected one of: none, view, pdf, both.",
        );
        printUsage(logger);
        process.exit(1);
      }

      html = value as CliOptions["html"];
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

  const absolutePath = path.resolve(process.cwd(), input);

  if (!fs.existsSync(absolutePath)) {
    logger.error({ path: absolutePath }, "XML file not found.");
    process.exit(1);
  }

  return {
    inputPath: absolutePath,
    report,
    html,
    diplomaTemplate,
  };
}
