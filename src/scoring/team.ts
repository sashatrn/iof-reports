import { Participant } from "../io/parse-iof";
import { AppConfig } from "../config";
import { Logger } from "pino";

export type GenderTeamResult = {
  club: string;
  points: number;
};

function matchesPrefix(value: string, prefixes: string[]) {
  return prefixes.some((prefix) => value.startsWith(prefix));
}

export function computeTeamResults(
  participants: Participant[],
  config: AppConfig,
  logger?: Logger,
): {
  men: GenderTeamResult[];
  women: GenderTeamResult[];
} {
  const menClasses = new Set<string>();
  const womenClasses = new Set<string>();

  for (const p of participants) {
    if (matchesPrefix(p.className, config.genderMapping.menPrefixes)) {
      menClasses.add(p.className);
    }
    if (matchesPrefix(p.className, config.genderMapping.womenPrefixes)) {
      womenClasses.add(p.className);
    }
  }

  logger?.info({ menClasses: [...menClasses] }, "Detected men classes");
  logger?.info({ womenClasses: [...womenClasses] }, "Detected women classes");

  if (menClasses.size !== 3) {
    logger?.error({ count: menClasses.size }, "Expected exactly 3 men classes");
  }

  if (womenClasses.size !== 3) {
    logger?.error({ count: womenClasses.size }, "Expected exactly 3 women classes");
  }

  const byClub = new Map<string, Participant[]>();

  for (const p of participants) {
    if (!byClub.has(p.club)) {
      byClub.set(p.club, []);
    }
    byClub.get(p.club)!.push(p);
  }

  const menResults: GenderTeamResult[] = [];
  const womenResults: GenderTeamResult[] = [];

  for (const [club, members] of byClub.entries()) {
    let menPoints = 0;
    for (const className of menClasses) {
      const top2 = members
        .filter((p) => p.className === className)
        .sort((a, b) => b.points - a.points)
        .slice(0, 2);

      if (top2.length > 0) {
        logger?.debug(
          { club, className, top2: top2.map((p) => ({ name: p.name, points: p.points })) },
          "Top 2 participants for club and class",
        );
      } else {
        logger?.debug({ club, className }, "No participants for club and class");
      }
      
      menPoints += top2.reduce((s, p) => s + p.points, 0);
    }

    let womenPoints = 0;
    for (const className of womenClasses) {
      const top2 = members
        .filter((p) => p.className === className)
        .sort((a, b) => b.points - a.points)
        .slice(0, 2);

      womenPoints += top2.reduce((s, p) => s + p.points, 0);
    }

    if (menPoints > 0) {
      menResults.push({ club, points: menPoints });
    }
    if (womenPoints > 0) {
      womenResults.push({ club, points: womenPoints });
    }
  }

  return {
    men: menResults.sort((a, b) => b.points - a.points),
    women: womenResults.sort((a, b) => b.points - a.points),
  };
}
