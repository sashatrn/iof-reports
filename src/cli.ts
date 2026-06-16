import fs from "fs";
import path from "path";
import { Logger } from "pino";
import { ReportType, REPORT_TYPES } from "./report-types";
import { type SummaryTeamSourceType } from "./reports/summary-team-source";

export type SeriesInputPath = {
  type: SummaryTeamSourceType;
  path: string;
};

export type CliOptions = {
  inputPath: string;
  seriesInputPaths: SeriesInputPath[];
  configPath?: string;
  courseDataPath?: string;
  bazaPath?: string;
  report: ReportType;
  format: "pdf";
  html: "none" | "view" | "pdf";
  awards: boolean;
  diplomaTemplate: "off" | "on";
};

const REPORT_VALUES = new Set<string>(REPORT_TYPES);
const HTML_VALUES = new Set<string>(["none", "view", "pdf"]);
const FORMAT_VALUES = new Set<string>(["pdf"]);
const DIPLOMA_TEMPLATE_VALUES = new Set<string>(["off", "on"]);
const SERIES_TYPE_ALIASES = new Map<string, SummaryTeamSourceType>([
  ["individual", "individual"],
  ["rogaining", "side-by-side-rogaining"],
  ["choice", "side-by-side-rogaining"],
  ["side-by-side-rogaining", "side-by-side-rogaining"],
  ["relay", "relay"],
]);

function printUsage(logger: Logger): void {
  logger.info(
    "Usage: node dist/index.js <file.xml> [--config config.json] [--report all|individual|individual-rogaining|team|side-by-side-rogaining|relay|summary-team|rogaining|rogaining-diplomas|rogaining-score|rogaining-results|rogaining-results-score|rogaining-splits] [--awards] [--format pdf] [--courses courses.xml] [--baza baza.xml] [--series individual=long.xml] [--html none|view|pdf] [--diploma-template off|on]",
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

function parseSeriesInputPath(value: string | undefined): SeriesInputPath {
  if (!value || value.startsWith("-")) {
    throw new Error("No source provided for --series.");
  }

  const separatorIndex = value.indexOf("=");

  if (separatorIndex <= 0 || separatorIndex === value.length - 1) {
    throw new Error("Invalid --series value. Expected type=path.xml.");
  }

  const typeToken = value.slice(0, separatorIndex);
  const sourceType = SERIES_TYPE_ALIASES.get(typeToken);

  if (!sourceType) {
    throw new Error(
      `Invalid --series type "${typeToken}". Expected individual, side-by-side-rogaining, or relay.`,
    );
  }

  return {
    type: sourceType,
    path: path.resolve(process.cwd(), value.slice(separatorIndex + 1)),
  };
}

export function parseCliArgs(argv: string[], logger: Logger): CliOptions {
  let input: string | undefined;
  const seriesInputPaths: SeriesInputPath[] = [];
  let report: CliOptions["report"] = "all";
  let configPath: string | undefined;
  let courseDataPath: string | undefined;
  let bazaPath: string | undefined;
  let format: CliOptions["format"] = "pdf";
  let html: CliOptions["html"] = "none";
  let awards = false;
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
          "Invalid report type. Expected one of: all, individual, individual-rogaining, team, side-by-side-rogaining, relay, summary-team, rogaining, rogaining-diplomas, rogaining-score, rogaining-results, rogaining-results-score, rogaining-splits.",
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

    if (arg === "--series") {
      try {
        seriesInputPaths.push(parseSeriesInputPath(argv[i + 1]));
      } catch (error) {
        logger.error((error as Error).message);
        printUsage(logger);
        process.exit(1);
      }

      i += 1;
      continue;
    }

    if (arg === "--baza" || arg === "--base") {
      const value = argv[i + 1];

      if (!value) {
        logger.error("No UOF baza XML file provided for --baza.");
        printUsage(logger);
        process.exit(1);
      }

      bazaPath = path.resolve(process.cwd(), value);
      i += 1;
      continue;
    }

    if (arg === "--awards") {
      awards = true;
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
          "Invalid format. Expected: pdf.",
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

  if (!input && !(report === "summary-team" && seriesInputPaths.length > 0)) {
    logger.error("No XML file provided.");
    printUsage(logger);
    process.exit(1);
  }

  const absolutePath = input
    ? path.resolve(process.cwd(), input)
    : seriesInputPaths[0].path;

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

  if (bazaPath && !fs.existsSync(bazaPath)) {
    logger.error({ path: bazaPath }, "UOF baza XML file not found.");
    process.exit(1);
  }

  for (const seriesInputPath of seriesInputPaths) {
    if (!fs.existsSync(seriesInputPath.path)) {
      logger.error({ path: seriesInputPath.path }, "Series IOF XML file not found.");
      process.exit(1);
    }
  }

  if (report === "rogaining-splits" && !courseDataPath) {
    logger.error("rogaining-splits report requires --courses <courses.xml>.");
    printUsage(logger);
    process.exit(1);
  }

  if (report === "rogaining-results" && !bazaPath) {
    logger.error("rogaining-results report requires --baza <baza.xml>.");
    printUsage(logger);
    process.exit(1);
  }

  if (report === "summary-team" && seriesInputPaths.length === 0) {
    logger.error("summary-team report requires at least one --series type=path.xml.");
    printUsage(logger);
    process.exit(1);
  }

  return {
    inputPath: absolutePath,
    seriesInputPaths,
    configPath,
    courseDataPath,
    bazaPath,
    report,
    format,
    html,
    awards,
    diplomaTemplate,
  };
}
