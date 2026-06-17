#!/usr/bin/env node
import fs from "fs";

import { htmlToPdf } from "./render/pdf";
import { getAppVersion } from "./app-version";
import { loadConfig, setConfigPath } from "./config";
import { createLogger } from "./logger";
import { extractConfigPathArg, parseCliArgs } from "./cli";
import { generateReportsHtml } from "./core/generate-report-html";
import { runWatchMode } from "./watch/run-watch-mode";

function writeHtmlOutputs(
  reportType: string,
  htmlMode: "none" | "view" | "pdf",
  viewHtml: string,
  pdfHtml: string,
  supportsView = true,
): void {
  if (htmlMode === "view" && supportsView) {
    fs.writeFileSync(`${reportType}.html`, viewHtml);
  }

  if (htmlMode === "pdf") {
    fs.writeFileSync(`${reportType}.pdf.html`, pdfHtml);
  }
}

async function main(): Promise<void> {
  if (process.argv[2] === "watch") {
    await runWatchMode(process.argv);
    return;
  }

  const configPath = extractConfigPathArg(process.argv);
  setConfigPath(configPath);
  const config = loadConfig();
  const logger = createLogger(config);
  logger.info({ version: getAppVersion() }, "iof-reports starting");

  const {
    inputPath,
    seriesInputPaths,
    courseDataPath,
    bazaPath,
    report,
    format,
    html,
    awards,
    diplomaTemplate,
  } = parseCliArgs(process.argv, logger, {
    summary: config.summary.series.length > 0,
    summaryTeam: config.summaryTeam.series.length > 0,
  });

  const configuredSeriesInputPaths =
    report === "summary"
      ? config.summary.series
      : report === "summary-team"
        ? config.summaryTeam.series
        : [];
  const effectiveSeriesInputPaths =
    seriesInputPaths.length > 0 ? seriesInputPaths : configuredSeriesInputPaths;
  const inputXmlPath = inputPath ?? effectiveSeriesInputPaths[0]?.path;

  if (!inputXmlPath) {
    throw new Error("No XML file provided.");
  }

  for (const seriesInputPath of effectiveSeriesInputPaths) {
    if (!fs.existsSync(seriesInputPath.path)) {
      logger.error({ path: seriesInputPath.path }, "Series IOF XML file not found.");
      process.exit(1);
    }
  }

  logger.info(
    {
      file: inputXmlPath,
      configPath,
      seriesInputPaths: effectiveSeriesInputPaths,
      courseDataPath,
      bazaPath,
      report,
      format,
      html,
      awards,
      diplomaTemplate,
    },
    "Reading XML file",
  );

  const xml = fs.readFileSync(inputXmlPath, "utf-8");
  const courseDataXml = courseDataPath ? fs.readFileSync(courseDataPath, "utf-8") : undefined;
  const bazaXml = bazaPath ? fs.readFileSync(bazaPath) : undefined;
  const summaryTeamSeriesXmls = report === "summary-team"
    ? effectiveSeriesInputPaths.map((input) => ({
      type: input.type,
      label: input.label,
      xml: fs.readFileSync(input.path, "utf-8"),
    }))
    : [];
  const summarySeriesXmls = report === "summary"
    ? effectiveSeriesInputPaths.map((input) => ({
      type: "individual" as const,
      label: input.label,
      xml: fs.readFileSync(input.path, "utf-8"),
    }))
    : [];
  const generatedReports = generateReportsHtml(xml, report, {
    logger,
    includeDiplomaBackground: diplomaTemplate === "on",
    courseDataXml,
    bazaXml,
    awardsOnly: awards,
    summarySeriesXmls,
    summaryTeamSeriesXmls,
  });

  for (const generatedReport of generatedReports) {
    const outputReportType = awards
      ? `${generatedReport.reportType}-awards`
      : generatedReport.reportType;

    writeHtmlOutputs(
      outputReportType,
      html,
      generatedReport.viewHtml,
      generatedReport.pdfHtml,
      generatedReport.supportsView,
    );

    if (format === "pdf") {
      await htmlToPdf(generatedReport.pdfHtml, `${outputReportType}.pdf`);
      logger.info(
        `${outputReportType[0].toUpperCase()}${outputReportType.slice(1)} PDF generated`,
      );
    }

  }

  logger.info("Report generation completed successfully");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
