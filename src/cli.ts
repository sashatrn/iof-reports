import fs from "fs";
import path from "path";
import { Logger } from "pino";

export type CliOptions = {
  inputPath: string;
  report: "all" | "individual" | "team";
};

const REPORT_VALUES = new Set(["all", "individual", "team"]);

function printUsage(logger: Logger): void {
  logger.info(
    "Usage: node dist/index.js <file.xml> [--report all|individual|team]",
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

  for (let i = 3; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--report" || arg === "-r") {
      const value = argv[i + 1];

      if (!value || !REPORT_VALUES.has(value)) {
        logger.error(
          { report: value },
          "Invalid report type. Expected one of: all, individual, team.",
        );
        printUsage(logger);
        process.exit(1);
      }

      report = value as CliOptions["report"];
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
  };
}
