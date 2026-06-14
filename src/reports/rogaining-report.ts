import path from "path";
import { AppConfig, loadConfig } from "../config";
import { CourseControlPoint, ParsedCourseData } from "../io/parse-course-data";
import { TeamIofSplit, TeamIofTeam } from "../io/parse-team-iof";
import { ParsedUofBaza, UofBazaSportsman } from "../io/parse-uof-baza";
import { DocxBlock, renderDocx } from "../render/docx";
import { renderTemplate } from "../render/template-engine";
import { isPdfVisibleTeam } from "./pdf-status-filter";
import { formatDate } from "../utils/date";
import { imageToBase64 } from "../utils/image";
import { getLeftLogo, getRightLogo } from "./report-logos";

type HtmlVariant = "view" | "pdf";

type RankedRogainingTeam = TeamIofTeam & {
  place: string;
  formattedTime: string;
  membersLine: string;
  sourceClassName: string;
  controlGateStatus: "OK" | "-" | "DSQ";
  grossScore: number;
};

const PLACEABLE_STATUSES = new Set(["OK"]);
const RESULTS_EXCLUDED_STATUSES = new Set(["DidNotStart", "DidNotFinish"]);
const OPEN_AGE = Number.POSITIVE_INFINITY;
const YOUTH_MAX_AGE = 23;
const MASTER_MIN_AGE = 45;
const AGGREGATE_OPEN_CLASS = "ALL";

type ParsedRogainingClass = {
  genderPrefix: string;
  genderGroup: "women" | "mix" | "men" | "unknown";
  ageLimit: number;
  originalName: string;
};

type RogainingClassGroup = {
  name: string;
  teams: RankedRogainingTeam[];
};

type RogainingDiplomaEntry = {
  participantName: string;
  teamName: string;
  className: string;
  place: string;
};

export type RogainingScoreEntry = {
  participantName: string;
  region: string;
  className: string;
  place: string;
  points: number;
};

export type RogainingRegionScoreEntry = {
  region: string;
  points: number;
};

type RogainingScoreCategory = "adult" | "masters" | "youthUnder23" | "youthUnder18";

type RogainingRegionGroupScoreEntry = {
  name: string;
  points: number;
  place: string;
};

type RogainingRegionGroupScoreRow = {
  number: number;
  left?: RogainingRegionGroupScoreEntry;
  right?: RogainingRegionGroupScoreEntry;
};

type RogainingScoreRegionGroups = {
  group1And2: RogainingRegionGroupScoreRow[];
  group3AndOrganizations: RogainingRegionGroupScoreRow[];
};

type RogainingFlatRegionScoreEntry = {
  number: number;
  name: string;
  points: number;
};

type RogainingFlatRegionScoreRow = {
  left?: RogainingFlatRegionScoreEntry;
  middle?: RogainingFlatRegionScoreEntry;
  organization?: RogainingFlatRegionScoreEntry;
};

type RogainingScoreRegionTables = {
  layout: AppConfig["rogaining"]["scoreReport"]["regionTableLayout"];
  groups: RogainingScoreRegionGroups;
  flatRows: RogainingFlatRegionScoreRow[];
};

type RogainingScoreReportInfo = {
  sport: string;
  competitionName: string;
  orderText: string;
  dateText: string;
  placeName: string;
  participantCount: number;
  regionCount: number;
  teamCount: number;
  teamPlaceText: string;
  eventInfo: string;
  resultsTitle: string;
  programName: string;
  departmentName: string;
  signatures: AppConfig["rogaining"]["scoreReport"]["signatures"];
};

type RogainingResultsMemberEntry = {
  name: string;
  birthday: string;
  region: string;
  trainers: string;
  qualification: string;
  awardedRank: string;
};

type RogainingResultsTeamEntry = {
  place: string;
  teamName: string;
  members: RogainingResultsMemberEntry[];
  score: number;
  penalty: number;
  totalScore: number;
  formattedTime: string;
  isDisqualified: boolean;
};

type RogainingResultsClassGroup = {
  name: string;
  courseRank: number;
  controlCount: number;
  controlTime: string;
  courseChief: string;
  teams: RogainingResultsTeamEntry[];
  rankInfoLines: string[];
};

type RogainingResultsScoreTeamEntry = {
  place: string;
  teamName: string;
  members: RogainingResultsMemberEntry[];
  score: number;
  penalty: number;
  totalScore: number;
  formattedTime: string;
  isDisqualified: boolean;
  points: number;
};

type RogainingResultsScoreClassGroup = {
  name: string;
  controlCount: number;
  controlTime: string;
  courseChief: string;
  teams: RogainingResultsScoreTeamEntry[];
};

type RogainingSplitLegEntry = {
  controlCode: string;
  legTime: string;
  legDistance: string;
  pace: string;
  totalTime: string;
  totalDistance: string;
};

type RogainingSplitTeamEntry = {
  teamName: string;
  className: string;
  membersLine: string;
  totalDistance: string;
  totalTime: string;
  score: number;
  penalty: number;
  legs: RogainingSplitLegEntry[];
};

type RogainingDiplomasOptions = {
  includeBackground: boolean;
};

type ControlGateRuleStatus = "OK" | "-" | "DSQ";

function evaluateControlGateRule(
  team: TeamIofTeam,
  config: AppConfig,
): {
  status: string;
  controlGateStatus: ControlGateRuleStatus;
} {
  const rule = config.rogaining.controlGateRule;

  if (!rule.enabled || team.status !== "OK") {
    return {
      status: team.status,
      controlGateStatus: "-",
    };
  }

  const restrictedControls = new Set(rule.restrictedControls);
  const memberControls =
    team.memberControls && team.memberControls.length > 0
      ? team.memberControls
      : [];

  let visitedRestrictedControl = false;

  for (const controls of memberControls) {
    let passedGateControl = false;

    for (let index = 0; index < controls.length; index += 1) {
      if (controls[index] === rule.gateControl) {
        passedGateControl = true;
      }

      const isRestrictedControl = restrictedControls.has(controls[index]);

      if (!isRestrictedControl) {
        continue;
      }

      visitedRestrictedControl = true;

      if (!passedGateControl) {
        return {
          status: rule.disqualifiedStatus,
          controlGateStatus: "DSQ",
        };
      }
    }
  }

  return {
    status: team.status,
    controlGateStatus: visitedRestrictedControl ? "OK" : "-",
  };
}

function applyRogainingRules(teams: TeamIofTeam[], config: AppConfig): TeamIofTeam[] {
  return teams.map((team) => {
    const controlGateRuleResult = evaluateControlGateRule(team, config);

    return {
      ...team,
      status: controlGateRuleResult.status,
      controlGateStatus: controlGateRuleResult.controlGateStatus,
    };
  });
}

function formatDuration(sec?: number): string {
  if (sec === undefined) {
    return "";
  }

  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const seconds = sec % 60;

  return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
    2,
    "0",
  )}`;
}

function getUkrainianMonthName(monthIndex: number): string {
  const monthNames = [
    "січня",
    "лютого",
    "березня",
    "квітня",
    "травня",
    "червня",
    "липня",
    "серпня",
    "вересня",
    "жовтня",
    "листопада",
    "грудня",
  ];

  return monthNames[monthIndex] ?? "";
}

function formatRogainingScoreDateText(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const monthName = getUkrainianMonthName(date.getMonth());

  return `з "${day}" по "${day}" ${monthName} ${date.getFullYear()} року`;
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function rankTeams(teams: TeamIofTeam[]): RankedRogainingTeam[] {
  const sortableTeams = [...teams].sort((left, right) => {
    const leftPlaceable = PLACEABLE_STATUSES.has(left.status);
    const rightPlaceable = PLACEABLE_STATUSES.has(right.status);

    if (leftPlaceable !== rightPlaceable) {
      return leftPlaceable ? -1 : 1;
    }

    if (leftPlaceable && rightPlaceable) {
      if (left.totalScore !== right.totalScore) {
        return right.totalScore - left.totalScore;
      }

      const leftTime = left.timeSec ?? Number.MAX_SAFE_INTEGER;
      const rightTime = right.timeSec ?? Number.MAX_SAFE_INTEGER;

      if (leftTime !== rightTime) {
        return leftTime - rightTime;
      }
    }

    const leftTime = left.timeSec ?? Number.MAX_SAFE_INTEGER;
    const rightTime = right.timeSec ?? Number.MAX_SAFE_INTEGER;

    if (leftTime !== rightTime) {
      return leftTime - rightTime;
    }

    return left.teamName.localeCompare(right.teamName, "uk");
  });

  let currentPlace = 0;

  return sortableTeams.map((team) => {
    if (PLACEABLE_STATUSES.has(team.status)) {
      currentPlace += 1;
    }

    return {
      ...team,
      place: PLACEABLE_STATUSES.has(team.status) ? String(currentPlace) : "",
      formattedTime: formatDuration(team.timeSec),
      membersLine: team.members.join(", "),
      sourceClassName: team.className,
      controlGateStatus: team.controlGateStatus ?? "-",
      grossScore: team.totalScore + team.penalty,
    };
  });
}

function startsWithAnyPrefix(value: string, prefixes: string[]): boolean {
  const normalizedValue = value.trim().toLowerCase();

  return prefixes.some((prefix) => normalizedValue.startsWith(prefix.trim().toLowerCase()));
}

function resolveGenderGroup(
  prefix: string,
  config: AppConfig,
): ParsedRogainingClass["genderGroup"] {
  if (startsWithAnyPrefix(prefix, config.genderMapping.womenPrefixes)) {
    return "women";
  }

  if (startsWithAnyPrefix(prefix, config.genderMapping.mixPrefixes)) {
    return "mix";
  }

  if (startsWithAnyPrefix(prefix, config.genderMapping.menPrefixes)) {
    return "men";
  }

  return "unknown";
}

function getGenderOrder(genderGroup: ParsedRogainingClass["genderGroup"]): number {
  switch (genderGroup) {
    case "women":
      return 0;
    case "mix":
      return 1;
    case "men":
      return 2;
    default:
      return 3;
  }
}

function parseRogainingClass(
  className: string,
  config: AppConfig,
): ParsedRogainingClass | undefined {
  const match = className.trim().match(/^([^\d]+?)\s*(\d+)?$/);

  if (!match) {
    return undefined;
  }

  const genderPrefix = match[1].trim();
  const ageLimit = match[2] ? Number(match[2]) : OPEN_AGE;

  if (!genderPrefix || Number.isNaN(ageLimit)) {
    return undefined;
  }

  return {
    genderPrefix,
    genderGroup: resolveGenderGroup(genderPrefix, config),
    ageLimit,
    originalName: className,
  };
}

function formatRogainingClassName(genderPrefix: string, ageLimit: number): string {
  return ageLimit === OPEN_AGE ? genderPrefix : `${genderPrefix}${ageLimit}`;
}

function getEligibleAgeLimits(
  ageLimit: number,
  declaredAgeLimits: number[],
): number[] {
  if (ageLimit === OPEN_AGE) {
    return [OPEN_AGE];
  }

  const eligible = new Set<number>([ageLimit, OPEN_AGE]);
  const youthClasses = declaredAgeLimits.filter((declaredAgeLimit) => {
    return declaredAgeLimit <= YOUTH_MAX_AGE && ageLimit <= declaredAgeLimit;
  });
  const masterClasses = declaredAgeLimits.filter((declaredAgeLimit) => {
    return declaredAgeLimit >= MASTER_MIN_AGE && ageLimit >= declaredAgeLimit;
  });

  for (const declaredAgeLimit of youthClasses) {
    eligible.add(declaredAgeLimit);
  }

  for (const declaredAgeLimit of masterClasses) {
    eligible.add(declaredAgeLimit);
  }

  return [...eligible];
}

function compareClassAgeLimits(left: number, right: number): number {
  if (left === right) {
    return 0;
  }

  if (left === OPEN_AGE) {
    return 1;
  }

  if (right === OPEN_AGE) {
    return -1;
  }

  const leftYouth = left <= 23;
  const rightYouth = right <= 23;

  if (leftYouth && rightYouth) {
    return left - right;
  }

  if (!leftYouth && !rightYouth) {
    return right - left;
  }

  return leftYouth ? -1 : 1;
}

function buildEligibleClassNames(
  team: TeamIofTeam,
  declaredClasses: ParsedRogainingClass[],
  config: AppConfig,
): string[] {
  const parsedClass = parseRogainingClass(team.className, config);

  if (!parsedClass) {
    return [team.className];
  }

  const declaredAgeLimits = declaredClasses
    .filter((declaredClass) => declaredClass.genderGroup === parsedClass.genderGroup)
    .map((declaredClass) => declaredClass.ageLimit);

  return getEligibleAgeLimits(parsedClass.ageLimit, declaredAgeLimits)
    .sort(compareClassAgeLimits)
    .flatMap((ageLimit) =>
      declaredClasses
        .filter((declaredClass) => {
          return (
            declaredClass.genderGroup === parsedClass.genderGroup &&
            declaredClass.ageLimit === ageLimit
          );
        })
        .map((declaredClass) => declaredClass.originalName),
    );
}

function buildRogainingClasses(
  teams: TeamIofTeam[],
  config: AppConfig,
): RogainingClassGroup[] {
  const byClass = new Map<string, TeamIofTeam[]>();
  const declaredClasses = new Set(teams.map((team) => team.className));
  const parsedDeclaredClasses = [...declaredClasses]
    .map((declaredClass) => parseRogainingClass(declaredClass, config))
    .filter((declaredClass): declaredClass is ParsedRogainingClass => {
      return declaredClass !== undefined;
    });

  for (const team of teams) {
    for (const className of buildEligibleClassNames(team, parsedDeclaredClasses, config)) {
      if (!declaredClasses.has(className)) {
        continue;
      }

      if (!byClass.has(className)) {
        byClass.set(className, []);
      }

      byClass.get(className)!.push(team);
    }
  }

  byClass.set(AGGREGATE_OPEN_CLASS, teams);

  return [...byClass.keys()]
    .sort((left, right) => {
      if (left === AGGREGATE_OPEN_CLASS) {
        return 1;
      }

      if (right === AGGREGATE_OPEN_CLASS) {
        return -1;
      }

      const leftParsed = parseRogainingClass(left, config);
      const rightParsed = parseRogainingClass(right, config);

      if (!leftParsed || !rightParsed) {
        return left.localeCompare(right, "uk");
      }

      const genderComparison =
        getGenderOrder(leftParsed.genderGroup) - getGenderOrder(rightParsed.genderGroup);

      if (genderComparison !== 0) {
        return genderComparison;
      }

      return compareClassAgeLimits(leftParsed.ageLimit, rightParsed.ageLimit);
    })
    .map((className) => ({
      name: className,
      teams: rankTeams(byClass.get(className)!),
    }))
    .filter((classGroup) => classGroup.teams.length > 0);
}

function buildDeclaredRogainingClasses(
  teams: TeamIofTeam[],
  config: AppConfig,
): RogainingClassGroup[] {
  const byClass = new Map<string, TeamIofTeam[]>();

  for (const team of teams) {
    if (!byClass.has(team.className)) {
      byClass.set(team.className, []);
    }

    byClass.get(team.className)!.push(team);
  }

  return [...byClass.keys()]
    .sort((left, right) => {
      const leftParsed = parseRogainingClass(left, config);
      const rightParsed = parseRogainingClass(right, config);

      if (!leftParsed || !rightParsed) {
        return left.localeCompare(right, "uk");
      }

      const genderComparison =
        getGenderOrder(leftParsed.genderGroup) - getGenderOrder(rightParsed.genderGroup);

      if (genderComparison !== 0) {
        return genderComparison;
      }

      return compareClassAgeLimits(leftParsed.ageLimit, rightParsed.ageLimit);
    })
    .map((className) => ({
      name: className,
      teams: rankTeams(byClass.get(className)!),
    }))
    .filter((classGroup) => classGroup.teams.length > 0);
}

function buildRogainingScoreClasses(
  teams: TeamIofTeam[],
  config: AppConfig,
): RogainingClassGroup[] {
  return config.rogaining.scoreClassMode === "declared"
    ? buildDeclaredRogainingClasses(teams, config)
    : buildRogainingClasses(teams, config);
}

function buildOpenRogainingResultsClasses(
  teams: TeamIofTeam[],
  config: AppConfig,
): RogainingClassGroup[] {
  const groups: Array<{
    name: string;
    genderGroup: ParsedRogainingClass["genderGroup"];
  }> = [
    { name: "Ч-О", genderGroup: "men" },
    { name: "Ж-О", genderGroup: "women" },
    { name: "МІКС-О", genderGroup: "mix" },
  ];
  const teamsByGroup = new Map<string, TeamIofTeam[]>(
    groups.map((group) => [group.name, []]),
  );

  for (const team of teams) {
    const parsedClass = parseRogainingClass(team.className, config);
    const group = groups.find((entry) => entry.genderGroup === parsedClass?.genderGroup);

    if (!group) {
      continue;
    }

    teamsByGroup.get(group.name)!.push(team);
  }

  return groups
    .map((group) => ({
      name: group.name,
      teams: rankTeams(teamsByGroup.get(group.name)!),
    }))
    .filter((classGroup) => classGroup.teams.length > 0);
}

function classifyAwardsClass(className: string, config: AppConfig): {
  bucket: number;
  ageOrder: number;
  genderOrder: number;
  normalizedName: string;
} {
  const normalizedName = className.trim();

  if (normalizedName === AGGREGATE_OPEN_CLASS) {
    return {
      bucket: 3,
      ageOrder: Number.MAX_SAFE_INTEGER,
      genderOrder: 0,
      normalizedName,
    };
  }

  const lower = normalizedName.toLowerCase();
  const parsedClass = parseRogainingClass(normalizedName, config);
  const ageLimit = parsedClass?.ageLimit ?? OPEN_AGE;
  const genderOrder = getGenderOrder(parsedClass?.genderGroup ?? "unknown");

  if (ageLimit !== OPEN_AGE && ageLimit <= YOUTH_MAX_AGE) {
    return {
      bucket: 1,
      ageOrder: ageLimit,
      genderOrder,
      normalizedName,
    };
  }

  if (
    lower.includes("стар") ||
    lower.includes("вет") ||
    (ageLimit !== OPEN_AGE && ageLimit >= MASTER_MIN_AGE)
  ) {
    const veteranOrder =
      ageLimit !== OPEN_AGE && ageLimit >= MASTER_MIN_AGE ? -ageLimit : -MASTER_MIN_AGE;

    return {
      bucket: 0,
      ageOrder: veteranOrder,
      genderOrder,
      normalizedName,
    };
  }

  if (
    lower.includes("юн") ||
    lower.includes("jun") ||
    lower.includes("молод")
  ) {
    return {
      bucket: 1,
      ageOrder: ageLimit !== OPEN_AGE ? ageLimit : YOUTH_MAX_AGE,
      genderOrder,
      normalizedName,
    };
  }

  return {
    bucket: 2,
    ageOrder: 0,
    genderOrder,
    normalizedName,
  };
}

function sortAwardsClasses(
  left: RogainingClassGroup,
  right: RogainingClassGroup,
  config: AppConfig,
): number {
  const leftMeta = classifyAwardsClass(left.name, config);
  const rightMeta = classifyAwardsClass(right.name, config);

  if (leftMeta.bucket !== rightMeta.bucket) {
    return leftMeta.bucket - rightMeta.bucket;
  }

  if (leftMeta.ageOrder !== rightMeta.ageOrder) {
    return leftMeta.ageOrder - rightMeta.ageOrder;
  }

  if (leftMeta.genderOrder !== rightMeta.genderOrder) {
    return leftMeta.genderOrder - rightMeta.genderOrder;
  }

  return leftMeta.normalizedName.localeCompare(rightMeta.normalizedName, "uk");
}

function buildAwardsClasses(
  teams: TeamIofTeam[],
  config: AppConfig,
): RogainingClassGroup[] {
  return buildRogainingClasses(teams, config)
    .map((classGroup) => ({
      ...classGroup,
      teams: classGroup.teams
        .filter((team) => team.place !== "")
        .slice(0, 3),
    }))
    .filter((classGroup) => classGroup.teams.length > 0)
    .sort((left, right) => sortAwardsClasses(left, right, config));
}

function getRogainingScorePointsMap(
  className: string,
  config: AppConfig,
): Record<string, number> | undefined {
  const category = getRogainingScoreCategory(className, config);

  switch (category) {
    case "youthUnder18":
      return config.rogaining.scorePoints.youthUnder18;
    case "youthUnder23":
      return config.rogaining.scorePoints.youthUnder23;
    case "adult":
      return config.rogaining.scorePoints.adult;
    case "masters":
      return config.rogaining.scorePoints.masters;
    default:
      return undefined;
  }
}

function getRogainingScoreCategory(
  className: string,
  config: AppConfig,
): RogainingScoreCategory | undefined {
  const parsedClass = parseRogainingClass(className, config);

  if (!parsedClass) {
    return undefined;
  }

  const ageLimit = parsedClass?.ageLimit ?? OPEN_AGE;

  if (ageLimit <= 18) {
    return "youthUnder18";
  }

  if (ageLimit <= 23) {
    return "youthUnder23";
  }

  if (ageLimit !== OPEN_AGE && ageLimit >= MASTER_MIN_AGE) {
    return "masters";
  }

  if (ageLimit === OPEN_AGE && parsedClass.genderGroup !== "unknown") {
    return "adult";
  }

  return undefined;
}

function getRogainingScorePoints(
  place: string,
  pointsMap: Record<string, number>,
): number {
  return pointsMap[place] ?? 0;
}

function normalizeRogainingRegion(region: string): string {
  const normalized = region.trim().replace(/\s+/g, " ");

  if (/^м\.\s*київ$/i.test(normalized)) {
    return "м. Київ";
  }

  if (/^м\.\s*севастополь$/i.test(normalized)) {
    return "м. Севастополь";
  }

  return normalized;
}

function getRogainingScoreMemberRegion(team: TeamIofTeam, memberIndex: number): string {
  const memberOrganisation = team.memberOrganisations?.[memberIndex];

  if (
    memberOrganisation &&
    memberOrganisation !== "Unknown" &&
    memberOrganisation.toLowerCase() !== "no club"
  ) {
    return normalizeRogainingRegion(memberOrganisation);
  }

  return normalizeRogainingRegion(team.organisation);
}

function createRogainingScoreEntries(
  teams: TeamIofTeam[],
  config: AppConfig,
  options: { includeZeroPoints?: boolean } = {},
): RogainingScoreEntry[] {
  return buildRogainingScoreClasses(teams, config)
    .filter((classGroup) => classGroup.name !== AGGREGATE_OPEN_CLASS)
    .flatMap((classGroup) => {
      const pointsMap = getRogainingScorePointsMap(classGroup.name, config);

      if (!pointsMap) {
        return [];
      }

      return classGroup.teams
        .filter((team) => team.place !== "")
        .flatMap((team) => {
          const points = getRogainingScorePoints(team.place, pointsMap);

          if (points === 0 && !options.includeZeroPoints) {
            return [];
          }

          return team.members.map((participantName, memberIndex) => ({
            participantName,
            region: getRogainingScoreMemberRegion(team, memberIndex),
            className: classGroup.name,
            place: team.place,
            points,
          }));
        });
    });
}

export function buildRogainingScoreEntries(teams: TeamIofTeam[]): RogainingScoreEntry[] {
  const config = loadConfig();
  const normalizedTeams = applyRogainingRules(teams, config);
  return createRogainingScoreEntries(normalizedTeams, config);
}

function buildRogainingRegionScoreEntries(
  entries: RogainingScoreEntry[],
): RogainingRegionScoreEntry[] {
  const pointsByRegion = new Map<string, number>();

  for (const entry of entries) {
    const region = normalizeRogainingRegion(entry.region);
    pointsByRegion.set(region, (pointsByRegion.get(region) ?? 0) + entry.points);
  }

  return [...pointsByRegion.entries()]
    .map(([region, points]) => ({ region, points }))
    .sort((left, right) => {
      if (left.points !== right.points) {
        return right.points - left.points;
      }

      return left.region.localeCompare(right.region, "uk");
    });
}

function countUniqueRogainingScoreEntryRegions(entries: RogainingScoreEntry[]): number {
  return new Set(entries.map((entry) => normalizeRogainingRegion(entry.region))).size;
}

function countUniqueRogainingScoreEntryParticipants(entries: RogainingScoreEntry[]): number {
  return new Set(
    entries.map((entry) => `${entry.participantName}\u0000${normalizeRogainingRegion(entry.region)}`),
  ).size;
}

function buildRegionScoreMap(
  regionScores: RogainingRegionScoreEntry[],
): Map<string, number> {
  return new Map(
    regionScores.map((entry) => [
      normalizeRogainingRegion(entry.region),
      entry.points,
    ]),
  );
}

function assignRegionGroupPlaces(
  entries: RogainingRegionGroupScoreEntry[],
): RogainingRegionGroupScoreEntry[] {
  const sortedWithPoints = entries
    .filter((entry) => entry.points > 0)
    .sort((left, right) => {
      if (left.points !== right.points) {
        return right.points - left.points;
      }

      return left.name.localeCompare(right.name, "uk");
    });
  const placesByName = new Map<string, string>();
  let previousPoints: number | undefined;
  let currentPlace = 0;

  sortedWithPoints.forEach((entry, index) => {
    if (entry.points !== previousPoints) {
      currentPlace = index + 1;
      previousPoints = entry.points;
    }

    placesByName.set(entry.name, String(currentPlace));
  });

  return entries.map((entry) => ({
    ...entry,
    place: placesByName.get(entry.name) ?? "",
  }));
}

function buildRegionGroupScoreEntries(
  regions: string[],
  pointsByRegion: Map<string, number>,
): RogainingRegionGroupScoreEntry[] {
  const entries = regions.map((region) => {
    const name = normalizeRogainingRegion(region);

    return {
      name,
      points: pointsByRegion.get(name) ?? 0,
      place: "",
    };
  });

  return assignRegionGroupPlaces(entries);
}

function buildRegionGroupRows(
  left: RogainingRegionGroupScoreEntry[],
  right: RogainingRegionGroupScoreEntry[],
): RogainingRegionGroupScoreRow[] {
  const rowCount = Math.max(left.length, right.length);

  return Array.from({ length: rowCount }, (_, index) => ({
    number: index + 1,
    left: left[index],
    right: right[index],
  }));
}

function buildRogainingScoreRegionGroups(
  config: AppConfig,
  regionScores: RogainingRegionScoreEntry[],
): RogainingScoreRegionGroups {
  const pointsByRegion = buildRegionScoreMap(regionScores);
  const regionGroups = config.rogaining.scoreReport.regionGroups;

  return {
    group1And2: buildRegionGroupRows(
      buildRegionGroupScoreEntries(regionGroups.group1, pointsByRegion),
      buildRegionGroupScoreEntries(regionGroups.group2, pointsByRegion),
    ),
    group3AndOrganizations: buildRegionGroupRows(
      buildRegionGroupScoreEntries(regionGroups.group3, pointsByRegion),
      buildRegionGroupScoreEntries(regionGroups.organizations, pointsByRegion),
    ),
  };
}

function buildFlatRegionScoreEntries(
  names: string[],
  pointsByRegion: Map<string, number>,
  startNumber = 1,
): RogainingFlatRegionScoreEntry[] {
  return names.map((region, index) => {
    const name = normalizeRogainingRegion(region);

    return {
      number: startNumber + index,
      name,
      points: pointsByRegion.get(name) ?? 0,
    };
  });
}

function buildFlatRegionScoreRows(
  config: AppConfig,
  regionScores: RogainingRegionScoreEntry[],
): RogainingFlatRegionScoreRow[] {
  const pointsByRegion = buildRegionScoreMap(regionScores);
  const flatRegions = config.rogaining.scoreReport.flatRegions.map(normalizeRogainingRegion);
  const firstColumnSize = Math.ceil(flatRegions.length / 2);
  const left = buildFlatRegionScoreEntries(
    flatRegions.slice(0, firstColumnSize),
    pointsByRegion,
    1,
  );
  const middle = buildFlatRegionScoreEntries(
    flatRegions.slice(firstColumnSize),
    pointsByRegion,
    firstColumnSize + 1,
  );
  const organizations = buildFlatRegionScoreEntries(
    config.rogaining.scoreReport.regionGroups.organizations,
    pointsByRegion,
    1,
  );
  const rowCount = Math.max(left.length, middle.length, organizations.length);

  return Array.from({ length: rowCount }, (_, index) => ({
    left: left[index],
    middle: middle[index],
    organization: organizations[index],
  }));
}

function buildRogainingScoreRegionTables(
  config: AppConfig,
  regionScores: RogainingRegionScoreEntry[],
): RogainingScoreRegionTables {
  return {
    layout: config.rogaining.scoreReport.regionTableLayout,
    groups: buildRogainingScoreRegionGroups(config, regionScores),
    flatRows: buildFlatRegionScoreRows(config, regionScores),
  };
}

function buildRogainingScoreReportInfo(
  config: AppConfig,
  eventDate: Date,
  eventName: string | undefined,
  scoringEntries: RogainingScoreEntry[],
): RogainingScoreReportInfo {
  const scoreReport = config.rogaining.scoreReport;
  const competitionName =
    config.rogaining.competitionName ??
    scoreReport.competitionName ??
    eventName ??
    `Протокол балів рогейну, ${formatDate(eventDate)}`;
  const regionCount = countUniqueRogainingScoreEntryRegions(scoringEntries);

  return {
    sport: scoreReport.sport,
    competitionName,
    orderText: scoreReport.orderText,
    dateText: scoreReport.dateText ?? formatRogainingScoreDateText(eventDate),
    placeName: scoreReport.placeName ?? config.reportHeader.location,
    participantCount: countUniqueRogainingScoreEntryParticipants(scoringEntries),
    regionCount,
    teamCount: regionCount,
    teamPlaceText: scoreReport.teamPlaceText,
    eventInfo: scoreReport.eventInfo,
    resultsTitle: scoreReport.resultsTitle ?? `Результати ${competitionName}`,
    programName: scoreReport.programName,
    departmentName: scoreReport.departmentName,
    signatures: scoreReport.signatures,
  };
}

function normalizePersonNameKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-zа-яіїєґ0-9]+/giu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right, "uk"))
    .join(" ");
}

function buildBazaIndex(baza: ParsedUofBaza): Map<string, UofBazaSportsman> {
  const index = new Map<string, UofBazaSportsman>();

  for (const sportsman of baza.sportsmen) {
    const key = normalizePersonNameKey(sportsman.fio);

    if (key && !index.has(key)) {
      index.set(key, sportsman);
    }
  }

  return index;
}

function findBazaSportsman(
  index: Map<string, UofBazaSportsman>,
  memberName: string,
): UofBazaSportsman | undefined {
  return index.get(normalizePersonNameKey(memberName));
}

function parseUkrainianDate(value: string): Date | undefined {
  const match = value.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);

  if (!match) {
    return undefined;
  }

  const date = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));

  return Number.isNaN(date.getTime()) ? undefined : date;
}

function calculateAgeOnDate(birthday: string, eventDate: Date): number | undefined {
  const birthDate = parseUkrainianDate(birthday);

  if (!birthDate) {
    return undefined;
  }

  let age = eventDate.getFullYear() - birthDate.getFullYear();
  const hadBirthday =
    eventDate.getMonth() > birthDate.getMonth() ||
    (eventDate.getMonth() === birthDate.getMonth() &&
      eventDate.getDate() >= birthDate.getDate());

  if (!hadBirthday) {
    age -= 1;
  }

  return age;
}

function normalizeQualification(qualification: string): string {
  return qualification
    .trim()
    .toUpperCase()
    .replace(/[ІЇ]/g, "I")
    .replace(/КМСУ?/g, "КМСУ")
    .replace(/МСМК/g, "МСУМК")
    .replace(/\s+/g, "");
}

function qualificationPoints(
  qualification: string,
  age: number | undefined,
): number {
  const normalized = normalizeQualification(qualification);

  if (normalized.includes("МСУМК")) {
    return 150;
  }

  if (normalized.includes("КМС")) {
    return 30;
  }

  if (normalized.includes("МСУ")) {
    return 100;
  }

  if (normalized === "I" || normalized === "1") {
    return 10;
  }

  if (normalized === "II" || normalized === "2" || normalized.includes("IЮН")) {
    return 3;
  }

  if (normalized === "III" || normalized === "3" || normalized.includes("IIЮН")) {
    return 1;
  }

  return age !== undefined && age <= 18 ? 0.1 : 0.3;
}

const ROGAINING_POINTS_CLASSIFICATION_TABLE = [
  { rank: 1200, kmsu: 74, first: 66, secondYouth1: 54, thirdYouth2: 49, youth3: undefined },
  { rank: 1100, kmsu: 76, first: 68, secondYouth1: 56, thirdYouth2: 50, youth3: undefined },
  { rank: 1000, kmsu: 78, first: 70, secondYouth1: 58, thirdYouth2: 51, youth3: undefined },
  { rank: 800, kmsu: 82, first: 72, secondYouth1: 60, thirdYouth2: 52, youth3: undefined },
  { rank: 630, kmsu: 84, first: 74, secondYouth1: 62, thirdYouth2: 53, youth3: undefined },
  { rank: 500, kmsu: 86, first: 76, secondYouth1: 64, thirdYouth2: 54, youth3: 46 },
  { rank: 400, kmsu: 88, first: 78, secondYouth1: 66, thirdYouth2: 55, youth3: 47 },
  { rank: 320, kmsu: 90, first: 80, secondYouth1: 68, thirdYouth2: 56, youth3: 48 },
  { rank: 250, kmsu: 92, first: 82, secondYouth1: 70, thirdYouth2: 57, youth3: 49 },
  { rank: 200, kmsu: 94, first: 84, secondYouth1: 72, thirdYouth2: 58, youth3: 50 },
  { rank: 160, kmsu: 97, first: 86, secondYouth1: 74, thirdYouth2: 60, youth3: 51 },
  { rank: 120, kmsu: 100, first: 88, secondYouth1: 76, thirdYouth2: 62, youth3: 52 },
  { rank: 100, kmsu: undefined, first: 90, secondYouth1: 78, thirdYouth2: 64, youth3: 53 },
  { rank: 80, kmsu: undefined, first: 92, secondYouth1: 80, thirdYouth2: 66, youth3: 54 },
  { rank: 63, kmsu: undefined, first: 94, secondYouth1: 82, thirdYouth2: 68, youth3: 55 },
  { rank: 50, kmsu: undefined, first: 97, secondYouth1: 84, thirdYouth2: 70, youth3: 56 },
  { rank: 36, kmsu: undefined, first: 100, secondYouth1: 86, thirdYouth2: 72, youth3: 57 },
  { rank: 32, kmsu: undefined, first: undefined, secondYouth1: 88, thirdYouth2: 74, youth3: 58 },
  { rank: 25, kmsu: undefined, first: undefined, secondYouth1: 90, thirdYouth2: 76, youth3: 60 },
  { rank: 20, kmsu: undefined, first: undefined, secondYouth1: 92, thirdYouth2: 78, youth3: 62 },
  { rank: 16, kmsu: undefined, first: undefined, secondYouth1: 95, thirdYouth2: 80, youth3: 64 },
  { rank: 13, kmsu: undefined, first: undefined, secondYouth1: 97, thirdYouth2: 82, youth3: 66 },
  { rank: 10, kmsu: undefined, first: undefined, secondYouth1: undefined, thirdYouth2: 84, youth3: 68 },
  { rank: 8, kmsu: undefined, first: undefined, secondYouth1: undefined, thirdYouth2: 86, youth3: 70 },
  { rank: 6, kmsu: undefined, first: undefined, secondYouth1: undefined, thirdYouth2: 88, youth3: 72 },
  { rank: 5, kmsu: undefined, first: undefined, secondYouth1: undefined, thirdYouth2: 90, youth3: 74 },
  { rank: 4, kmsu: undefined, first: undefined, secondYouth1: undefined, thirdYouth2: 94, youth3: 78 },
  { rank: 3, kmsu: undefined, first: undefined, secondYouth1: undefined, thirdYouth2: undefined, youth3: 80 },
  { rank: 2, kmsu: undefined, first: undefined, secondYouth1: undefined, thirdYouth2: undefined, youth3: 82 },
  { rank: 1, kmsu: undefined, first: undefined, secondYouth1: undefined, thirdYouth2: undefined, youth3: 88 },
] as const;

type RogainingPointsClassificationRow = (typeof ROGAINING_POINTS_CLASSIFICATION_TABLE)[number];

function getClassificationRow(courseRank: number): RogainingPointsClassificationRow | undefined {
  return ROGAINING_POINTS_CLASSIFICATION_TABLE.find((row) => courseRank >= row.rank);
}

function buildClassRankInfoLines(
  courseRank: number,
  winnerScore: number,
  classificationRow: RogainingPointsClassificationRow | undefined,
  msuPlaces: number[],
  msuEarned: boolean,
  isOpenClass: boolean,
): string[] {
  if (!classificationRow || winnerScore === 0) return [];

  const distanceClass =
    isOpenClass && msuPlaces.length > 0
      ? "МСУ"
      : classificationRow.kmsu !== undefined
        ? "КМСУ"
        : classificationRow.first !== undefined
          ? "І р-д"
          : "ІІ р-д";

  const lines: string[] = [];
  lines.push(`Клас дистанції: ${distanceClass}; Ранг дистанції: ${formatCourseRank(courseRank)}`);

  const thresholds: string[] = [];
  if (msuEarned && msuPlaces.length > 0) {
    thresholds.push(`${msuPlaces.join("-")} місце - МСУ`);
  }
  if (classificationRow.kmsu !== undefined) {
    thresholds.push(`КМСУ - ${classificationRow.kmsu}% - ${Math.floor((winnerScore * classificationRow.kmsu) / 100)}`);
  }
  if (classificationRow.first !== undefined) {
    thresholds.push(`І р-д - ${classificationRow.first}% - ${Math.floor((winnerScore * classificationRow.first) / 100)}`);
  }
  if (classificationRow.secondYouth1 !== undefined) {
    thresholds.push(`ІІ р-д - ${classificationRow.secondYouth1}% - ${Math.floor((winnerScore * classificationRow.secondYouth1) / 100)}`);
  }
  if (classificationRow.thirdYouth2 !== undefined) {
    thresholds.push(`ІІІ р-д - ${classificationRow.thirdYouth2}% - ${Math.floor((winnerScore * classificationRow.thirdYouth2) / 100)}`);
  }

  if (thresholds.length > 0) {
    lines.push(thresholds.join("; "));
  }

  return lines;
}

function isOpenRogainingClass(className: string, config: AppConfig): boolean {
  const parsed = parseRogainingClass(className, config);

  return Boolean(parsed && parsed.ageLimit === OPEN_AGE && parsed.genderGroup !== "unknown");
}

function buildMemberData(
  team: RankedRogainingTeam,
  memberIndex: number,
  bazaIndex: Map<string, UofBazaSportsman>,
  eventDate: Date,
): { member: RogainingResultsMemberEntry; qualificationScore: number; age?: number } {
  const name = team.members[memberIndex];
  const sportsman = findBazaSportsman(bazaIndex, name);
  const birthday = sportsman?.birthday ?? "";
  const age = calculateAgeOnDate(birthday, eventDate);
  const qualification = sportsman?.qualification || "";
  const region =
    sportsman?.region ||
    team.memberOrganisations?.[memberIndex] ||
    team.organisation;

  return {
    member: {
      name: sportsman?.fio || name,
      birthday,
      region: normalizeRogainingRegion(region),
      trainers: sportsman?.trainers.join(", ") || "",
      qualification,
      awardedRank: "",
    },
    qualificationScore: qualificationPoints(qualification, age),
    age,
  };
}

function calculateCourseRank(
  rankedTeams: RankedRogainingTeam[],
  bazaIndex: Map<string, UofBazaSportsman>,
  eventDate: Date,
): number {
  const qualificationScores: number[] = [];

  for (const team of rankedTeams.filter((rankedTeam) => rankedTeam.place !== "")) {
    for (let memberIndex = 0; memberIndex < team.members.length; memberIndex += 1) {
      qualificationScores.push(
        buildMemberData(team, memberIndex, bazaIndex, eventDate).qualificationScore,
      );

      if (qualificationScores.length >= 12) {
        break;
      }
    }

    if (qualificationScores.length >= 12) {
      break;
    }
  }

  if (qualificationScores.length < 3) {
    return 0;
  }

  const sum = qualificationScores.reduce((total, score) => total + score, 0);

  return Math.round(sum * 10) / 10;
}

function formatCourseRank(courseRank: number): string {
  return Number.isInteger(courseRank) ? String(courseRank) : courseRank.toFixed(1);
}

function resolveClassificationRank(
  row: RogainingPointsClassificationRow | undefined,
  score: number,
  winnerScore: number,
): string {
  if (!row || winnerScore === 0) {
    return "";
  }

  const threshold = (pct: number) => Math.floor((winnerScore * pct) / 100);

  if (row.kmsu !== undefined && score >= threshold(row.kmsu)) return "КМСУ";
  if (row.first !== undefined && score >= threshold(row.first)) return "I";
  if (row.secondYouth1 !== undefined && score >= threshold(row.secondYouth1)) return "II";
  if (row.thirdYouth2 !== undefined && score >= threshold(row.thirdYouth2)) return "III";
  if (row.youth3 !== undefined && score >= threshold(row.youth3)) return "III";

  return "";
}

function estimateClassControlCount(teams: RankedRogainingTeam[]): number {
  return teams.reduce((maxControls, team) => {
    const teamControls = new Set<string>();

    for (const memberSplits of team.memberSplits ?? []) {
      for (const split of memberSplits) {
        if (split.controlCode) {
          teamControls.add(split.controlCode);
        }
      }
    }

    return Math.max(maxControls, teamControls.size);
  }, 0);
}

function buildRogainingResultsClasses(
  teams: TeamIofTeam[],
  baza: ParsedUofBaza,
  eventDate: Date,
  config: AppConfig,
): RogainingResultsClassGroup[] {
  const bazaIndex = buildBazaIndex(baza);
  const rankedClasses = buildOpenRogainingResultsClasses(teams, config);
  const resultsReport = config.rogaining.resultsReport;

  return rankedClasses.map((classGroup) => {
    const placeableTeams = classGroup.teams.filter((team) => team.place !== "");
    const winnerScore = placeableTeams[0]?.totalScore ?? 0;
    const courseRank = calculateCourseRank(classGroup.teams, bazaIndex, eventDate);
    const classificationRow = getClassificationRow(courseRank);
    const classRegions = new Set<string>();

    for (const team of placeableTeams) {
      for (let memberIndex = 0; memberIndex < team.members.length; memberIndex += 1) {
        const region = buildMemberData(team, memberIndex, bazaIndex, eventDate).member.region;
        if (region) {
          classRegions.add(region);
        }
      }
    }

    const isOpenClass = isOpenRogainingClass(classGroup.name, config);
    const hasEnoughRegionsForMsu = classRegions.size >= resultsReport.minRegionsForMsu;
    const msuEarned = isOpenClass && hasEnoughRegionsForMsu && resultsReport.msuPlaces.length > 0;
    const rankInfoLines = buildClassRankInfoLines(
      courseRank,
      winnerScore,
      classificationRow,
      resultsReport.msuPlaces,
      msuEarned,
      isOpenClass,
    );

    const resultTeams = classGroup.teams
    .filter((team) => !RESULTS_EXCLUDED_STATUSES.has(team.status))
    .map((team) => {
      const place = Number(team.place);
      const earnsMsu =
        Number.isFinite(place) &&
        resultsReport.msuPlaces.includes(place) &&
        isOpenRogainingClass(classGroup.name, config) &&
        classRegions.size >= resultsReport.minRegionsForMsu;
      const isDisqualified = team.place === "";
      const effectiveScore = isDisqualified ? 0 : team.totalScore;

      return {
        place: team.place,
        teamName: team.teamName,
        members: team.members.map((_, memberIndex) => {
          const memberData = buildMemberData(team, memberIndex, bazaIndex, eventDate);
          return {
            ...memberData.member,
            awardedRank: earnsMsu
              ? "МСУ"
              : resolveClassificationRank(classificationRow, effectiveScore, winnerScore),
          };
        }),
        score: team.grossScore,
        penalty: team.penalty,
        totalScore: team.totalScore,
        formattedTime: team.formattedTime,
        isDisqualified,
      };
    });

    return {
      name: classGroup.name,
      courseRank,
      controlCount: resultsReport.controlCount ?? estimateClassControlCount(classGroup.teams),
      controlTime: resultsReport.controlTime,
      courseChief: resultsReport.courseChief,
      teams: resultTeams,
      rankInfoLines,
    };
  });
}

function buildCourseControlMap(courseData: ParsedCourseData): Map<string, CourseControlPoint> {
  return new Map(courseData.controls.map((control) => [control.id, control]));
}

function getStartControl(controlMap: Map<string, CourseControlPoint>): CourseControlPoint | undefined {
  return controlMap.get("S1") ?? [...controlMap.values()].find((control) => control.id.startsWith("S"));
}

function getFinishControl(
  controlMap: Map<string, CourseControlPoint>,
  startControl: CourseControlPoint | undefined,
): CourseControlPoint | undefined {
  return (
    controlMap.get("F1") ??
    [...controlMap.values()].find((control) => control.id.toUpperCase().startsWith("F")) ??
    startControl
  );
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function haversineDistanceMeters(left: CourseControlPoint, right: CourseControlPoint): number | undefined {
  if (
    left.lat === undefined ||
    left.lng === undefined ||
    right.lat === undefined ||
    right.lng === undefined
  ) {
    return undefined;
  }

  const earthRadiusMeters = 6371000;
  const latDelta = toRadians(right.lat - left.lat);
  const lngDelta = toRadians(right.lng - left.lng);
  const leftLat = toRadians(left.lat);
  const rightLat = toRadians(right.lat);
  const halfChord =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(leftLat) * Math.cos(rightLat) * Math.sin(lngDelta / 2) ** 2;

  return 2 * earthRadiusMeters * Math.asin(Math.sqrt(halfChord));
}

function courseDistanceMeters(
  left: CourseControlPoint,
  right: CourseControlPoint,
  scale?: number,
): number | undefined {
  if (
    scale !== undefined &&
    left.mapX !== undefined &&
    left.mapY !== undefined &&
    right.mapX !== undefined &&
    right.mapY !== undefined &&
    left.mapUnit === "mm" &&
    right.mapUnit === "mm"
  ) {
    return Math.hypot(right.mapX - left.mapX, right.mapY - left.mapY) * scale / 1000;
  }

  return haversineDistanceMeters(left, right);
}

function formatDistance(distanceMeters?: number): string {
  if (distanceMeters === undefined) {
    return "";
  }

  return `${(distanceMeters / 1000).toFixed(2)} км`;
}

function formatPace(timeSec: number | undefined, distanceMeters: number | undefined): string {
  if (timeSec === undefined || distanceMeters === undefined || distanceMeters <= 0) {
    return "";
  }

  const paceSec = Math.round(timeSec / (distanceMeters / 1000));
  const minutes = Math.floor(paceSec / 60);
  const seconds = paceSec % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function deduplicateAdjacentSplits(
  splits: Required<TeamIofSplit>[],
): Required<TeamIofSplit>[] {
  return splits.reduce<Required<TeamIofSplit>[]>((deduplicated, split) => {
    const previousSplit = deduplicated[deduplicated.length - 1];

    if (previousSplit?.controlCode === split.controlCode) {
      previousSplit.timeSec = Math.max(previousSplit.timeSec, split.timeSec);
      return deduplicated;
    }

    deduplicated.push({ ...split });
    return deduplicated;
  }, []);
}

function normalizeSplitSequence(splits: TeamIofSplit[] | undefined): Required<TeamIofSplit>[] {
  const chronologicalSplits = (splits ?? [])
    .filter((split): split is Required<TeamIofSplit> => {
      return split.controlCode !== "" && split.timeSec !== undefined;
    })
    .sort((left, right) => left.timeSec - right.timeSec);

  return deduplicateAdjacentSplits(chronologicalSplits);
}

function selectTeamSplitSequence(team: TeamIofTeam): Required<TeamIofSplit>[] {
  const sequences = (team.memberSplits ?? [])
    .map((splits) => normalizeSplitSequence(splits))
    .filter((splits) => splits.length > 0);

  if (sequences.length === 0) {
    return [];
  }

  const baseSequence = sequences.reduce((longest, current) => {
    return current.length > longest.length ? current : longest;
  }, sequences[0]);

  return baseSequence.map((baseSplit, index) => {
    const matchingTimes = sequences
      .map((sequence) => sequence[index])
      .filter((split): split is Required<TeamIofSplit> => {
        return split !== undefined && split.controlCode === baseSplit.controlCode;
      })
      .map((split) => split.timeSec);

    return {
      controlCode: baseSplit.controlCode,
      timeSec: matchingTimes.length > 0 ? Math.max(...matchingTimes) : baseSplit.timeSec,
    };
  });
}

function sortRogainingSplitsTeams(teams: TeamIofTeam[]): RankedRogainingTeam[] {
  const byClass = new Map<string, TeamIofTeam[]>();

  for (const team of teams) {
    const classTeams = byClass.get(team.className) ?? [];
    classTeams.push(team);
    byClass.set(team.className, classTeams);
  }

  return [...byClass.keys()]
    .sort((left, right) => left.localeCompare(right, "uk"))
    .flatMap((className) => rankTeams(byClass.get(className) ?? []));
}

export function buildRogainingSplitTeamEntries(
  teams: TeamIofTeam[],
  courseData: ParsedCourseData,
): RogainingSplitTeamEntry[] {
  const controlMap = buildCourseControlMap(courseData);
  const startControl = getStartControl(controlMap);
  const finishControl = getFinishControl(controlMap, startControl);

  return sortRogainingSplitsTeams(teams).map((team) => {
    const splitSequence = selectTeamSplitSequence(team);
    let previousControl = startControl;
    let previousTimeSec = 0;
    let totalDistanceMeters = 0;
    const legs = splitSequence.map((split) => {
      const currentControl = controlMap.get(split.controlCode);
      const legTimeSec = Math.max(0, split.timeSec - previousTimeSec);
      const legDistanceMeters =
        previousControl && currentControl
          ? courseDistanceMeters(previousControl, currentControl, courseData.scale)
          : undefined;

      if (legDistanceMeters !== undefined) {
        totalDistanceMeters += legDistanceMeters;
      }

      previousTimeSec = Math.max(previousTimeSec, split.timeSec);

      if (currentControl) {
        previousControl = currentControl;
      }

      return {
        controlCode: split.controlCode,
        legTime: formatDuration(legTimeSec),
        legDistance: formatDistance(legDistanceMeters),
        pace: formatPace(legTimeSec, legDistanceMeters),
        totalTime: formatDuration(split.timeSec),
        totalDistance: formatDistance(totalDistanceMeters),
      };
    });

    if (team.timeSec !== undefined) {
      const legTimeSec = Math.max(0, team.timeSec - previousTimeSec);
      const legDistanceMeters =
        previousControl && finishControl
          ? courseDistanceMeters(previousControl, finishControl, courseData.scale)
          : undefined;

      if (legDistanceMeters !== undefined) {
        totalDistanceMeters += legDistanceMeters;
      }

      legs.push({
        controlCode: "Фініш",
        legTime: formatDuration(legTimeSec),
        legDistance: formatDistance(legDistanceMeters),
        pace: formatPace(legTimeSec, legDistanceMeters),
        totalTime: formatDuration(team.timeSec),
        totalDistance: formatDistance(totalDistanceMeters),
      });
    }

    return {
      teamName: team.teamName,
      className: team.className,
      membersLine: team.membersLine,
      totalDistance: formatDistance(totalDistanceMeters),
      totalTime: formatDuration(team.timeSec),
      score: team.grossScore,
      penalty: team.penalty,
      legs,
    };
  });
}

export function buildRogainingHtml(
  teams: TeamIofTeam[],
  eventDate: Date,
  eventName?: string,
  variant: HtmlVariant = "pdf",
): string {
  const config = loadConfig();
  const normalizedTeams = applyRogainingRules(teams, config);
  const reportTeams = variant === "pdf"
    ? normalizedTeams.filter(isPdfVisibleTeam)
    : normalizedTeams;

  const classes = buildRogainingClasses(reportTeams, config).filter((classGroup) => {
    return variant === "view" || classGroup.name !== AGGREGATE_OPEN_CLASS;
  });

  return renderTemplate(`rogaining-${variant}.njk`, {
    reportTitle: "Протокол результатів рогейну",
    event: {
      title:
        config.reportHeader.title ??
        eventName ??
        `Протокол результатів рогейну, ${formatDate(eventDate)}`,
      subtitle: "",
      // "Ранжування: очки мінус штраф; при рівності вище команда з ранішим фінішем. Команди автоматично входять у всі вікові класи, для яких вони придатні.",
      location: config.reportHeader.location,
      date: formatDate(eventDate),
      logo1: getLeftLogo(config, "logo1.png"),
      logo2: getRightLogo(config, "irf-logo.png"),
    },
    officials: config.officials,
    classes,
    showControlGateColumn: config.rogaining.controlGateRule.enabled,
    controlGateLabel: `КП ${config.rogaining.controlGateRule.gateControl}`,
  });
}

export function buildRogainingScoreHtml(
  teams: TeamIofTeam[],
  eventDate: Date,
  eventName?: string,
  variant: HtmlVariant = "pdf",
): string {
  const config = loadConfig();
  const normalizedTeams = applyRogainingRules(teams, config);
  const allEntries = createRogainingScoreEntries(normalizedTeams, config, {
    includeZeroPoints: true,
  });
  const entries = allEntries.filter((entry) => entry.points !== 0);
  const regionScores = buildRogainingRegionScoreEntries(entries);
  const scoreReport = buildRogainingScoreReportInfo(
    config,
    eventDate,
    eventName,
    allEntries,
  );
  const regionTables = buildRogainingScoreRegionTables(config, regionScores);
  void variant;

  return renderTemplate("rogaining-score-pdf.njk", {
    reportTitle: "Протокол балів рогейну",
    showDefaultHeader: false,
    showDefaultFooter: false,
    officials: config.officials,
    scoreReport,
    regionTables,
    entries,
  });
}

export function buildRogainingResultsHtml(
  teams: TeamIofTeam[],
  baza: ParsedUofBaza,
  eventDate: Date,
  eventName?: string,
  variant: HtmlVariant = "pdf",
): string {
  const config = loadConfig();
  const normalizedTeams = applyRogainingRules(teams, config);
  const resultsReport = config.rogaining.resultsReport;
  void variant;

  return renderTemplate("rogaining-results-pdf.njk", {
    reportTitle: "Протокол результатів змагань з орієнтування",
    showDefaultHeader: false,
    showDefaultFooter: false,
    logo1: getLeftLogo(config, "logo1.png"),
    logo2: getRightLogo(config, "irf-logo.png"),
    header: {
      lines: resultsReport.headerLines,
      competitionName:
        config.rogaining.competitionName ??
        config.reportHeader.title ??
        eventName ??
        baza.eventName ??
        `Протокол результатів рогейну, ${formatDate(eventDate)}`,
      title: resultsReport.title,
      programName: resultsReport.programName,
      date: formatDate(eventDate),
      location: config.reportHeader.location,
    },
    officials: config.officials,
    classes: buildRogainingResultsClasses(normalizedTeams, baza, eventDate, config).map(
      (classGroup) => ({
        ...classGroup,
        formattedCourseRank: formatCourseRank(classGroup.courseRank),
      }),
    ),
  });
}

function buildRogainingResultsScoreClasses(
  teams: TeamIofTeam[],
  baza: ParsedUofBaza,
  eventDate: Date,
  config: AppConfig,
): RogainingResultsScoreClassGroup[] {
  const bazaIndex = buildBazaIndex(baza);
  const resultsReport = config.rogaining.resultsReport;

  const eligibleClasses = buildRogainingScoreClasses(teams, config)
    .filter((classGroup) => classGroup.name !== AGGREGATE_OPEN_CLASS)
    .filter((classGroup) => getRogainingScorePointsMap(classGroup.name, config) !== undefined);

  // Teams that earn points in their own declared class should not get points in other classes
  const teamsWithOwnClassPoints = new Set<string>();
  for (const classGroup of eligibleClasses) {
    const pointsMap = getRogainingScorePointsMap(classGroup.name, config)!;
    for (const team of classGroup.teams) {
      if (team.className === classGroup.name && !RESULTS_EXCLUDED_STATUSES.has(team.status)) {
        const points = team.place !== "" ? getRogainingScorePoints(team.place, pointsMap) : 0;
        if (points > 0) {
          teamsWithOwnClassPoints.add(team.teamName);
        }
      }
    }
  }

  return eligibleClasses.map((classGroup) => {
    const pointsMap = getRogainingScorePointsMap(classGroup.name, config)!;

    const resultTeams = classGroup.teams
      .filter((team) => !RESULTS_EXCLUDED_STATUSES.has(team.status))
      .map((team) => {
        const isDisqualified = team.place === "";
        const earnedInOwnClass =
          team.className !== classGroup.name && teamsWithOwnClassPoints.has(team.teamName);
        const points =
          isDisqualified || earnedInOwnClass ? 0 : getRogainingScorePoints(team.place, pointsMap);

        return {
          place: team.place,
          teamName: team.teamName,
          members: team.members.map((_, memberIndex) => {
            const memberData = buildMemberData(team, memberIndex, bazaIndex, eventDate);
            return { ...memberData.member, awardedRank: "" };
          }),
          score: team.grossScore,
          penalty: team.penalty,
          totalScore: team.totalScore,
          formattedTime: team.formattedTime,
          isDisqualified,
          points,
        };
      });

    return {
      name: classGroup.name,
      controlCount: resultsReport.controlCount ?? estimateClassControlCount(classGroup.teams),
      controlTime: resultsReport.controlTime,
      courseChief: resultsReport.courseChief,
      teams: resultTeams,
    };
  });
}

export function buildRogainingResultsScoreHtml(
  teams: TeamIofTeam[],
  baza: ParsedUofBaza,
  eventDate: Date,
  eventName?: string,
  variant: HtmlVariant = "pdf",
): string {
  const config = loadConfig();
  const normalizedTeams = applyRogainingRules(teams, config);
  const resultsReport = config.rogaining.resultsReport;
  void variant;

  return renderTemplate("rogaining-results-score-pdf.njk", {
    reportTitle: "Протокол результатів змагань з орієнтування",
    showDefaultHeader: false,
    showDefaultFooter: false,
    logo1: getLeftLogo(config, "logo1.png"),
    logo2: getRightLogo(config, "irf-logo.png"),
    header: {
      lines: resultsReport.headerLines,
      competitionName:
        config.rogaining.competitionName ??
        config.reportHeader.title ??
        eventName ??
        baza.eventName ??
        `Протокол результатів рогейну, ${formatDate(eventDate)}`,
      title: resultsReport.title,
      programName: resultsReport.programName,
      date: formatDate(eventDate),
      location: config.reportHeader.location,
    },
    officials: config.officials,
    classes: buildRogainingResultsScoreClasses(normalizedTeams, baza, eventDate, config),
  });
}

export function buildRogainingSplitsHtml(
  teams: TeamIofTeam[],
  courseData: ParsedCourseData,
  eventDate: Date,
  eventName?: string,
  variant: HtmlVariant = "pdf",
): string {
  const config = loadConfig();
  const normalizedTeams = applyRogainingRules(teams, config);
  const splitTeams = buildRogainingSplitTeamEntries(normalizedTeams, courseData);
  void variant;

  return renderTemplate("rogaining-splits-pdf.njk", {
    reportTitle: "Спліти рогейну",
    event: {
      title:
        config.reportHeader.title ??
        eventName ??
        `Спліти рогейну, ${formatDate(eventDate)}`,
      subtitle: "",
      location: config.reportHeader.location,
      date: formatDate(eventDate),
      logo1: getLeftLogo(config, "logo1.png"),
      logo2: getRightLogo(config, "irf-logo.png"),
    },
    officials: config.officials,
    teams: splitTeams,
  });
}

export function buildRogainingAwardsHtml(
  teams: TeamIofTeam[],
  eventDate: Date,
  eventName?: string,
  variant: HtmlVariant = "pdf",
): string {
  const config = loadConfig();
  const normalizedTeams = applyRogainingRules(teams, config);
  void variant;
  const classes = buildAwardsClasses(normalizedTeams, config);

  return renderTemplate("rogaining-awards-pdf.njk", {
    reportTitle: "Нагородний протокол рогейну",
    event: {
      title:
        config.reportHeader.title ??
        eventName ??
        `Нагородний протокол рогейну, ${formatDate(eventDate)}`,
      subtitle: "",
      location: config.reportHeader.location,
      date: formatDate(eventDate),
      logo1: getLeftLogo(config, "logo1.png"),
      logo2: getRightLogo(config, "irf-logo.png"),
    },
    officials: config.officials,
    classes,
  });
}

export function buildRogainingAwardsDocx(
  teams: TeamIofTeam[],
  eventDate: Date,
  eventName?: string,
): Buffer {
  const config = loadConfig();
  const normalizedTeams = applyRogainingRules(teams, config);
  const classes = buildAwardsClasses(normalizedTeams, config);
  const eventTitle = stripHtml(
    config.reportHeader.title ??
      eventName ??
      `Нагородний протокол рогейну, ${formatDate(eventDate)}`,
  );
  const blocks: DocxBlock[] = [
    {
      type: "paragraph",
      text: eventTitle,
      style: "title",
    },
    {
      type: "paragraph",
      text: "Нагородний протокол рогейну",
      style: "subtitle",
    },
    {
      type: "paragraph",
      text: `${config.reportHeader.location}    ${formatDate(eventDate)}`,
    },
  ];

  for (const classGroup of classes) {
    blocks.push({
      type: "paragraph",
      text: classGroup.name,
      style: "heading",
    });
    blocks.push({
      type: "table",
      columnWidths: [700, 2300, 1100, 4200, 2200, 900, 1200],
      rows: [
        [
          { text: "Місце" },
          { text: "Команда" },
          { text: "Заявл. клас" },
          { text: "Учасники" },
          { text: "Регіон" },
          { text: "Разом" },
          { text: "Час" },
        ],
        ...classGroup.teams.map((team) => [
          { text: team.place, bold: true },
          { text: team.teamName, bold: true },
          { text: team.sourceClassName },
          { text: team.membersLine },
          { text: team.organisation },
          { text: String(team.totalScore), bold: true },
          { text: team.formattedTime },
        ]),
      ],
    });
  }

  blocks.push(
    {
      type: "paragraph",
      text: "",
    },
    {
      type: "paragraph",
      text: `Головний суддя    ${config.officials.chiefJudge.name}`,
    },
    {
      type: "paragraph",
      text: `Головний секретар    ${config.officials.chiefSecretary.name}`,
    },
  );

  return renderDocx(blocks, { orientation: "landscape" });
}

export function buildRogainingDiplomasHtml(
  teams: TeamIofTeam[],
  eventDate: Date,
  eventName?: string,
  variant: HtmlVariant = "pdf",
  options: RogainingDiplomasOptions = { includeBackground: false },
): string {
  const config = loadConfig();
  const normalizedTeams = applyRogainingRules(teams, config);
  const diplomaTemplatePath = path.resolve(
    __dirname,
    "../assets/rogaining-diploma-template.png",
  );
  void variant;
  const entries: RogainingDiplomaEntry[] = buildAwardsClasses(normalizedTeams, config)
    .filter((classGroup) => classGroup.name !== AGGREGATE_OPEN_CLASS)
    .flatMap((classGroup) =>
      classGroup.teams.flatMap((team) =>
        team.members.map((participantName) => ({
          participantName,
          teamName: team.teamName,
          className: classGroup.name,
          place: team.place,
        })),
      ),
    );

  return renderTemplate("rogaining-diplomas-pdf.njk", {
    reportTitle: "Дипломи рогейну",
    event: {
      title:
        config.reportHeader.title ??
        eventName ??
        `Дипломи рогейну, ${formatDate(eventDate)}`,
      subtitle: "",
      location: config.reportHeader.location,
      date: formatDate(eventDate),
    },
    includeBackground: options.includeBackground,
    diplomaTemplate: options.includeBackground ? imageToBase64(diplomaTemplatePath) : undefined,
    entries,
  });
}
