#!/usr/bin/env node
import fs from "fs";

import { parseIof } from "./io/parse-iof";
import { pointsFromPosition } from "./scoring/points";
import { computeTeamResults } from "./scoring/team";
import { buildIndividualHtml } from "./reports/individual-report";
import { buildRogainingHtml } from "./reports/rogaining-report";
import { buildTeamHtml } from "./reports/team-report";
import { htmlToPdf } from "./render/pdf";
import { loadConfig } from "./config";
import { createLogger } from "./logger";
import { parseCliArgs } from "./cli";
import { parseRogainingIof } from "./io/parse-rogaining-iof";

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger(config);

  const { inputPath, report } = parseCliArgs(process.argv, logger);

  logger.info({ file: inputPath, report }, "Reading XML file");

  const xml = fs.readFileSync(inputPath, "utf-8");

  if (report === "rogaining") {
    let { eventDate, eventName, teams } = parseRogainingIof(xml);

    if (!eventDate) {
      logger.warn("Event date not found in IOF XML. Defaulting to current date.");
      eventDate = new Date();
    }

    logger.info({ count: teams.length }, "Rogaining teams parsed successfully");

    const rogainingHtml = buildRogainingHtml(teams, eventDate, eventName);
    await htmlToPdf(rogainingHtml, "rogaining.pdf");

    logger.info("Rogaining PDF generated");
    logger.info("Report generation completed successfully");
    return;
  }

  let { participants, eventDate } = parseIof(xml);
  if (!eventDate) {
    logger.warn("Event date not found in IOF XML. Defaulting to current date.");
    eventDate = new Date();
  }

  if (participants.length === 0) {
    logger.error(
      "No individual athlete results found in IOF XML. If this is a rogaining TeamResult export, use --report rogaining.",
    );
    process.exit(1);
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
