#!/usr/bin/env node
import fs from "fs";

import { htmlToPdf } from "./render/pdf";
import { loadConfig } from "./config";
import { createLogger } from "./logger";
import { parseCliArgs } from "./cli";
import { generateReportsHtml } from "./core/generate-report-html";
import { runWatchMode } from "./watch/run-watch-mode";

function writeHtmlOutputs(
  reportType: string,
  htmlMode: "none" | "view" | "pdf" | "both",
  viewHtml: string,
  pdfHtml: string,
): void {
  if (htmlMode === "view" || htmlMode === "both") {
    fs.writeFileSync(`${reportType}.html`, viewHtml);
  }

  if (htmlMode === "pdf" || htmlMode === "both") {
    fs.writeFileSync(`${reportType}.pdf.html`, pdfHtml);
  }
}

async function main(): Promise<void> {
  if (process.argv[2] === "watch") {
    await runWatchMode(process.argv);
    return;
  }

  const config = loadConfig();
  const logger = createLogger(config);

  const { inputPath, report, html } = parseCliArgs(process.argv, logger);

  logger.info({ file: inputPath, report, html }, "Reading XML file");

  const xml = fs.readFileSync(inputPath, "utf-8");
  const generatedReports = generateReportsHtml(xml, report, { logger });

  for (const generatedReport of generatedReports) {
    writeHtmlOutputs(
      generatedReport.reportType,
      html,
      generatedReport.viewHtml,
      generatedReport.pdfHtml,
    );
    await htmlToPdf(generatedReport.pdfHtml, `${generatedReport.reportType}.pdf`);
    logger.info(
      `${generatedReport.reportType[0].toUpperCase()}${generatedReport.reportType.slice(1)} PDF generated`,
    );
  }

  logger.info("Report generation completed successfully");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
