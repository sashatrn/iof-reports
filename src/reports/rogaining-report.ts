import path from "path";
import { AppConfig, loadConfig } from "../config";
import { CourseControlPoint, ParsedCourseData } from "../io/parse-course-data";
import { RogainingSplit, RogainingTeam } from "../io/parse-rogaining-iof";
import { renderTemplate } from "../render/template-engine";
import { formatDate } from "../utils/date";
import { imageToBase64 } from "../utils/image";

type HtmlVariant = "view" | "pdf";

type RankedRogainingTeam = RogainingTeam & {
  place: string;
  formattedTime: string;
  membersLine: string;
  sourceClassName: string;
  controlGateStatus: "OK" | "-" | "DSQ";
  grossScore: number;
};

const PLACEABLE_STATUSES = new Set(["OK"]);
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
  team: RogainingTeam,
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

function applyRogainingRules(teams: RogainingTeam[], config: AppConfig): RogainingTeam[] {
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

function rankTeams(teams: RogainingTeam[]): RankedRogainingTeam[] {
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
  team: RogainingTeam,
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
  teams: RogainingTeam[],
  config: AppConfig,
): RogainingClassGroup[] {
  const byClass = new Map<string, RogainingTeam[]>();
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
  teams: RogainingTeam[],
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

function getRogainingScoreMemberRegion(team: RogainingTeam, memberIndex: number): string {
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
  teams: RogainingTeam[],
  config: AppConfig,
  options: { includeZeroPoints?: boolean } = {},
): RogainingScoreEntry[] {
  return buildRogainingClasses(teams, config)
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

export function buildRogainingScoreEntries(teams: RogainingTeam[]): RogainingScoreEntry[] {
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

function buildRogainingScoreReportInfo(
  config: AppConfig,
  eventDate: Date,
  eventName: string | undefined,
  scoringEntries: RogainingScoreEntry[],
): RogainingScoreReportInfo {
  const scoreReport = config.rogaining.scoreReport;
  const competitionName =
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
  splits: Required<RogainingSplit>[],
): Required<RogainingSplit>[] {
  return splits.reduce<Required<RogainingSplit>[]>((deduplicated, split) => {
    const previousSplit = deduplicated[deduplicated.length - 1];

    if (previousSplit?.controlCode === split.controlCode) {
      previousSplit.timeSec = Math.max(previousSplit.timeSec, split.timeSec);
      return deduplicated;
    }

    deduplicated.push({ ...split });
    return deduplicated;
  }, []);
}

function normalizeSplitSequence(splits: RogainingSplit[] | undefined): Required<RogainingSplit>[] {
  const chronologicalSplits = (splits ?? [])
    .filter((split): split is Required<RogainingSplit> => {
      return split.controlCode !== "" && split.timeSec !== undefined;
    })
    .sort((left, right) => left.timeSec - right.timeSec);

  return deduplicateAdjacentSplits(chronologicalSplits);
}

function selectTeamSplitSequence(team: RogainingTeam): Required<RogainingSplit>[] {
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
      .filter((split): split is Required<RogainingSplit> => {
        return split !== undefined && split.controlCode === baseSplit.controlCode;
      })
      .map((split) => split.timeSec);

    return {
      controlCode: baseSplit.controlCode,
      timeSec: matchingTimes.length > 0 ? Math.max(...matchingTimes) : baseSplit.timeSec,
    };
  });
}

function sortRogainingSplitsTeams(teams: RogainingTeam[]): RankedRogainingTeam[] {
  const byClass = new Map<string, RogainingTeam[]>();

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
  teams: RogainingTeam[],
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
  teams: RogainingTeam[],
  eventDate: Date,
  eventName?: string,
  variant: HtmlVariant = "pdf",
): string {
  const config = loadConfig();
  const normalizedTeams = applyRogainingRules(teams, config);
  const logo1Path = path.resolve(__dirname, "../assets/logo1.png");
  const logo2Path = path.resolve(__dirname, "../assets/irf-logo.png");

  const classes = buildRogainingClasses(normalizedTeams, config).filter((classGroup) => {
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
      logo1: imageToBase64(logo1Path),
      logo2: imageToBase64(logo2Path),
    },
    officials: config.officials,
    classes,
    showControlGateColumn: config.rogaining.controlGateRule.enabled,
    controlGateLabel: `КП ${config.rogaining.controlGateRule.gateControl}`,
  });
}

export function buildRogainingScoreHtml(
  teams: RogainingTeam[],
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
  const regionGroups = buildRogainingScoreRegionGroups(config, regionScores);
  void variant;

  return renderTemplate("rogaining-score-pdf.njk", {
    reportTitle: "Протокол балів рогейну",
    showDefaultHeader: false,
    showDefaultFooter: false,
    officials: config.officials,
    scoreReport,
    regionGroups,
    entries,
  });
}

export function buildRogainingSplitsHtml(
  teams: RogainingTeam[],
  courseData: ParsedCourseData,
  eventDate: Date,
  eventName?: string,
  variant: HtmlVariant = "pdf",
): string {
  const config = loadConfig();
  const normalizedTeams = applyRogainingRules(teams, config);
  const logo1Path = path.resolve(__dirname, "../assets/logo1.png");
  const logo2Path = path.resolve(__dirname, "../assets/irf-logo.png");
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
      logo1: imageToBase64(logo1Path),
      logo2: imageToBase64(logo2Path),
    },
    officials: config.officials,
    teams: splitTeams,
  });
}

export function buildRogainingAwardsHtml(
  teams: RogainingTeam[],
  eventDate: Date,
  eventName?: string,
  variant: HtmlVariant = "pdf",
): string {
  const config = loadConfig();
  const normalizedTeams = applyRogainingRules(teams, config);
  const logo1Path = path.resolve(__dirname, "../assets/logo1.png");
  const logo2Path = path.resolve(__dirname, "../assets/irf-logo.png");
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
      logo1: imageToBase64(logo1Path),
      logo2: imageToBase64(logo2Path),
    },
    officials: config.officials,
    classes,
  });
}

export function buildRogainingDiplomasHtml(
  teams: RogainingTeam[],
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
