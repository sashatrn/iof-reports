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

  const { inputPath, relayInputPath, courseDataPath, bazaPath, report, format, html, diplomaTemplate } = parseCliArgs(process.argv, logger);

  logger.info({ file: inputPath, configPath, relayInputPath, courseDataPath, bazaPath, report, format, html, diplomaTemplate }, "Reading XML file");

  const xml = fs.readFileSync(inputPath, "utf-8");
  const relayXml = relayInputPath ? fs.readFileSync(relayInputPath, "utf-8") : undefined;
  const courseDataXml = courseDataPath ? fs.readFileSync(courseDataPath, "utf-8") : undefined;
  const bazaXml = bazaPath ? fs.readFileSync(bazaPath) : undefined;
  const generatedReports = generateReportsHtml(xml, report, {
    logger,
    includeDiplomaBackground: diplomaTemplate === "on",
    courseDataXml,
    bazaXml,
    relayXml,
  });

  for (const generatedReport of generatedReports) {
    writeHtmlOutputs(
      generatedReport.reportType,
      html,
      generatedReport.viewHtml,
      generatedReport.pdfHtml,
      generatedReport.supportsView,
    );

    if (format === "pdf") {
      await htmlToPdf(generatedReport.pdfHtml, `${generatedReport.reportType}.pdf`);
      logger.info(
        `${generatedReport.reportType[0].toUpperCase()}${generatedReport.reportType.slice(1)} PDF generated`,
      );
    }

    if (format === "docx") {
      if (!generatedReport.docx) {
        throw new Error(`${generatedReport.reportType} does not support DOCX export yet.`);
      }

      fs.writeFileSync(`${generatedReport.reportType}.docx`, generatedReport.docx);
      logger.info(
        `${generatedReport.reportType[0].toUpperCase()}${generatedReport.reportType.slice(1)} DOCX generated`,
      );
    }
  }

  logger.info("Report generation completed successfully");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
