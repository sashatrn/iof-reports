import crypto from "crypto";
import fs from "fs";
import path from "path";
import { loadConfig } from "../config";
import { generateReportHtml } from "../core/generate-report-html";
import { createLogger } from "../logger";
import { parseWatchArgs } from "./cli";
import { findLatestXml } from "./find-latest-xml";
import { renderViewerPage } from "./viewer-page";
import { readWatchState, writeWatchState } from "./watch-state";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
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
  const config = loadConfig();
  const logger = createLogger(config);
  const options = parseWatchArgs(argv, logger);
  const statePath = path.join(options.outputDir, ".watch-state.json");
  let state = readWatchState(statePath);
  let running = false;

  fs.mkdirSync(options.outputDir, { recursive: true });

  logger.info(
    {
      inputDir: options.inputDir,
      outputDir: options.outputDir,
      report: options.reportType,
      pollMs: options.pollMs,
      settleMs: options.settleMs,
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
      const hash = sha256(xml);

      if (state.lastFilePath === latestFile.path && state.lastFileHash === hash) {
        logger.debug({ file: latestFile.path }, "No XML changes detected");
        return;
      }

      const generatedReport = generateReportHtml(xml, options.reportType, {
        logger,
      });
      const updatedAt = new Date().toISOString();

      fs.writeFileSync(path.join(options.outputDir, "report.html"), generatedReport.html);
      fs.writeFileSync(
        path.join(options.outputDir, "meta.json"),
        JSON.stringify(
          {
            sourceFilePath: latestFile.path,
            sourceFileName: latestFile.name,
            reportType: generatedReport.reportType,
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
            `${generatedReport.reportType} report`,
          sourceFileName: latestFile.name,
          reportType: generatedReport.reportType,
          updatedAt,
        }),
      );

      state = {
        lastFilePath: latestFile.path,
        lastFileHash: hash,
        updatedAt,
      };
      writeWatchState(statePath, state);

      logger.info(
        {
          file: latestFile.path,
          reportType: generatedReport.reportType,
          outputDir: options.outputDir,
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
      clearInterval(timer);
      logger.info("Watch mode stopped");
      resolve();
    };

    process.on("SIGINT", stop);
    process.on("SIGTERM", stop);
  });
}
