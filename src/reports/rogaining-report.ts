import path from "path";
import { AppConfig, loadConfig } from "../config";
import { RogainingTeam } from "../io/parse-rogaining-iof";
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
