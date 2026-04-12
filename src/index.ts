#!/usr/bin/env node
import fs from "fs";

import { parseIof } from "./io/parseIof";
import { pointsFromPosition } from "./scoring/points";
import { computeTeamResults } from "./scoring/team";
import { buildIndividualHtml } from "./reports/individualReport";
import { buildTeamHtml } from "./reports/teamReport";
import { htmlToPdf } from "./render/pdf";
import { loadConfig } from "./config";
import { createLogger } from "./logger";
import { parseCliArgs } from "./cli";

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger(config);

  const { inputPath, report } = parseCliArgs(process.argv, logger);

  logger.info({ file: inputPath, report }, "Reading XML file");

  const xml = fs.readFileSync(inputPath, "utf-8");
  let { participants, eventDate } = parseIof(xml);
  if (!eventDate) {
    logger.warn("Event date not found in IOF XML. Defaulting to current date.");
    eventDate = new Date();
  }

  logger.info(
    { count: participants.length },
    "Participants parsed successfully",
  );

  for (const p of participants) {
    p.points = pointsFromPosition(p.position, p.status);
  }

  if (report === "all" || report === "individual") {
    const individualHtml = buildIndividualHtml(participants, eventDate);
    await htmlToPdf(individualHtml, "individual.pdf");
    logger.info("Individual PDF generated");
  }

  if (report === "all" || report === "team") {
    const teamResults = computeTeamResults(participants, config, logger);
    const teamHtml = buildTeamHtml(teamResults, eventDate);
    await htmlToPdf(teamHtml, "team.pdf");
    logger.info("Team PDF generated");
  }

  logger.info("Report generation completed successfully");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
