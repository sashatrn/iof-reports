import crypto from "crypto";
import fs from "fs";
import path from "path";
import { getAppVersion } from "../app-version";
import { extractConfigPathArg } from "../cli";
import { loadConfig, setConfigPath } from "../config";
import { generateReportHtml } from "../core/generate-report-html";
import { createLogger } from "../logger";
import { parseWatchArgs } from "./cli";
import { findLatestXml } from "./find-latest-xml";
import { startWatchHttpServer } from "./http-server";
import { renderViewerPage } from "./viewer-page";
import { readWatchState, writeWatchState } from "./watch-state";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function renderWaitingReportHtml(reportType: string): string {
  return `<!DOCTYPE html>
<html lang="uk">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Очікування XML</title>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      font-family: "Segoe UI", sans-serif;
      color: #263238;
      background: #fff;
    }
    main {
      max-width: 560px;
      padding: 32px;
      text-align: center;
    }
    h1 {
      margin: 0 0 12px;
      font-size: 28px;
      font-weight: 650;
    }
    p {
      margin: 0;
      color: #607d8b;
      font-size: 16px;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <main>
    <h1>Очікування файлу з MeOS</h1>
    <p>Watch-режим запущено для звіту ${reportType}. Коли у вхідній папці з'явиться XML, ця сторінка оновиться автоматично.</p>
  </main>
</body>
</html>`;
}

export function ensureInitialWatchOutput(outputDir: string, reportType: string): void {
  const updatedAt = new Date().toISOString();
  const reportPath = path.join(outputDir, "report.html");
  const reportPdfPath = path.join(outputDir, "report.pdf.html");
  const metaPath = path.join(outputDir, "meta.json");
  const viewerPath = path.join(outputDir, "viewer.html");

  if (!fs.existsSync(reportPath)) {
    fs.writeFileSync(reportPath, renderWaitingReportHtml(reportType));
  }

  if (!fs.existsSync(reportPdfPath)) {
    fs.writeFileSync(reportPdfPath, renderWaitingReportHtml(reportType));
  }

  if (!fs.existsSync(metaPath)) {
    fs.writeFileSync(
      metaPath,
      JSON.stringify(
        {
          sourceFilePath: null,
          sourceFileName: "очікування XML",
          reportType,
          updatedAt,
        },
        null,
        2,
      ),
    );
  }

  if (!fs.existsSync(viewerPath)) {
    fs.writeFileSync(
      viewerPath,
      renderViewerPage({
        title: "Очікування XML",
        sourceFileName: "очікування XML",
        reportType,
        updatedAt,
      }),
    );
  }
}

async function isFileStable(filePath: string, settleMs: number): Promise<boolean> {
  const before = fs.statSync(filePath).size;

  if (settleMs > 0) {
    await sleep(settleMs);
  }

  const after = fs.statSync(filePath).size;
  return before === after;
}

export async function runWatchMode(argv: string[]): Promise<void> {
  const configPath = extractConfigPathArg(argv);
  setConfigPath(configPath);
  const config = loadConfig();
  const logger = createLogger(config);
  logger.info({ version: getAppVersion() }, "iof-reports watch starting");
  const options = parseWatchArgs(argv, logger);
  const statePath = path.join(options.outputDir, ".watch-state.json");
  let state = readWatchState(statePath);
  let forceRegenerate = true;
  let running = false;
  let stopping = false;

  fs.mkdirSync(options.outputDir, { recursive: true });
  ensureInitialWatchOutput(options.outputDir, options.requestedReportType);
  const httpServer = startWatchHttpServer(options.outputDir, options.port, logger);

  logger.info(
    {
      inputDir: options.inputDir,
      outputDir: options.outputDir,
      report: options.requestedReportType,
      generationReport: options.reportType,
      pollMs: options.pollMs,
      settleMs: options.settleMs,
      port: options.port,
      awards: options.awards,
      diplomas: options.diplomas,
      diplomaTemplate: options.diplomaTemplate,
      configPath: options.configPath,
      courseDataPath: options.courseDataPath,
    },
    "Watching directory for latest XML",
  );

  const runCycle = async (): Promise<void> => {
    if (running) {
      return;
    }

    running = true;

    try {
      const latestFile = findLatestXml(options.inputDir);

      if (!latestFile) {
        logger.debug("No XML files found in watched directory");
        return;
      }

      logger.debug(
        { file: latestFile.path, size: latestFile.size, mtimeMs: latestFile.mtimeMs },
        "Latest XML candidate detected",
      );

      if (!(await isFileStable(latestFile.path, options.settleMs))) {
        logger.info({ file: latestFile.path }, "Latest XML is still being written. Skipping cycle.");
        return;
      }

      const xml = fs.readFileSync(latestFile.path, "utf-8");
      const courseDataXml = options.courseDataPath
        ? fs.readFileSync(options.courseDataPath, "utf-8")
        : undefined;
      const hash = sha256(`${xml}\n${courseDataXml ?? ""}`);

      if (!forceRegenerate && state.lastFilePath === latestFile.path && state.lastFileHash === hash) {
        logger.debug({ file: latestFile.path }, "No XML changes detected");
        return;
      }

      const generatedReport = generateReportHtml(xml, options.reportType, {
        logger,
        includeDiplomaBackground: options.diplomaTemplate === "on",
        courseDataXml,
        awardsOnly: options.awards,
        diplomas: options.diplomas,
      });
      const updatedAt = new Date().toISOString();

      fs.writeFileSync(path.join(options.outputDir, "report.html"), generatedReport.viewHtml);
      fs.writeFileSync(path.join(options.outputDir, "report.pdf.html"), generatedReport.pdfHtml);
      fs.writeFileSync(
        path.join(options.outputDir, "meta.json"),
        JSON.stringify(
          {
            sourceFilePath: latestFile.path,
            sourceFileName: latestFile.name,
            reportType: options.requestedReportType,
            awards: options.awards,
            diplomas: options.diplomas,
            eventName: generatedReport.eventName,
            eventDate: generatedReport.eventDate,
            itemCount: generatedReport.itemCount,
            updatedAt,
          },
          null,
          2,
        ),
      );
      fs.writeFileSync(
        path.join(options.outputDir, "viewer.html"),
        renderViewerPage({
          title:
            generatedReport.eventName ??
            `${options.requestedReportType} report`,
          sourceFileName: latestFile.name,
          reportType: options.requestedReportType,
          updatedAt,
        }),
      );

      state = {
        lastFilePath: latestFile.path,
        lastFileHash: hash,
        updatedAt,
      };
      writeWatchState(statePath, state);
      forceRegenerate = false;

      logger.info(
        {
          file: latestFile.path,
          reportType: options.requestedReportType,
          generationReportType: generatedReport.reportType,
          outputDir: options.outputDir,
          viewerUrl: `http://127.0.0.1:${options.port}/viewer`,
          reportUrl: `http://127.0.0.1:${options.port}/report`,
          metaUrl: `http://127.0.0.1:${options.port}/meta`,
        },
        "HTML report regenerated from latest XML",
      );
    } catch (error) {
      logger.error({ err: error }, "Watch cycle failed");
    } finally {
      running = false;
    }
  };

  await runCycle();
  const timer = setInterval(() => {
    void runCycle();
  }, options.pollMs);

  await new Promise<void>((resolve) => {
    const stop = () => {
      if (stopping) {
        return;
      }

      stopping = true;
      clearInterval(timer);

      void httpServer
        .close()
        .catch((error) => {
          logger.error({ err: error }, "Failed to stop watch HTTP server cleanly");
        })
        .finally(() => {
          logger.info("Watch mode stopped");
          resolve();
        });
    };

    process.on("SIGINT", stop);
    process.on("SIGTERM", stop);
  });
}
