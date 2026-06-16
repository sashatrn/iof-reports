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
  } = parseCliArgs(process.argv, logger);

  logger.info(
    {
      file: inputPath,
      configPath,
      seriesInputPaths,
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

  const xml = fs.readFileSync(inputPath, "utf-8");
  const courseDataXml = courseDataPath ? fs.readFileSync(courseDataPath, "utf-8") : undefined;
  const bazaXml = bazaPath ? fs.readFileSync(bazaPath) : undefined;
  const summaryTeamSeriesXmls = seriesInputPaths.map((input) => ({
    type: input.type,
    xml: fs.readFileSync(input.path, "utf-8"),
  }));
  const generatedReports = generateReportsHtml(xml, report, {
    logger,
    includeDiplomaBackground: diplomaTemplate === "on",
    courseDataXml,
    bazaXml,
    awardsOnly: awards,
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
