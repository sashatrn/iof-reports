import fs from "fs";
import path from "path";
import { imageToBase64 } from "./utils/image";

type RogainingScorePoints = {
  youthUnder18?: Record<string, number>;
  youthUnder23?: Record<string, number>;
  adult?: Record<string, number>;
  masters?: Record<string, number>;
};

export type ClassGroupConfig = {
  name: string;
  classRegex: string;
};

export type MilitaryIndividualTeamGroupConfig = ClassGroupConfig;

type SideBySideConfig = {
  teamRules: {
    menCount: number;
    womenCount: number;
  };
};

export type IndividualScoringType = "regular" | "side-by-side" | "military";
export type IndividualClassOrderType = "name" | "grouped";
export type IndividualTeamResultsType = "none" | "gender" | "grouped";

type IndividualConfig = {
  scoring: IndividualScoringType;
  classOrder: IndividualClassOrderType;
  teamResults: IndividualTeamResultsType;
  teamFilterRegex: string;
  classFilterRegex: string;
  classOrderGroups: ClassGroupConfig[];
  reportTitle: string;
  title?: string;
  subtitle?: string;
};

type OfficialPersonConfig = {
  name: string;
  signatureFile?: string;
  signatureImage?: string;
};

type OfficialsConfig = {
  chiefJudge: OfficialPersonConfig;
  chiefSecretary: OfficialPersonConfig;
  joury1?: OfficialPersonConfig;
  joury2?: OfficialPersonConfig;
  joury3?: OfficialPersonConfig;
  departmentHead?: OfficialPersonConfig;
  sportResponsible?: OfficialPersonConfig;
};

type OfficialRole = keyof OfficialsConfig;

type OfficialPersonInput =
  | string
  | {
      name?: string;
      signatureFile?: string;
      signatureImage?: string;
    };

type RawOfficialsConfig = Partial<Record<OfficialRole, OfficialPersonInput>> & {
  chiefJudgeSignatureFile?: string;
  chiefSecretarySignatureFile?: string;
  joury1SignatureFile?: string;
  joury2SignatureFile?: string;
  joury3SignatureFile?: string;
  departmentHeadSignatureFile?: string;
  sportResponsibleSignatureFile?: string;
};

export type AppConfig = {
  logging: {
    level: string;
  };
  ignoredStatuses: string[];
  leftLogo?: string;
  rightLogo?: string;
  individual: IndividualConfig;
  "side-by-side": SideBySideConfig;
  military: {
    teamFilterRegex: string;
    classFilterRegex: string;
    individualTeamGroups: MilitaryIndividualTeamGroupConfig[];
  };
  rogaining: {
    controlGateRule: {
      enabled: boolean;
      gateControl: string;
      restrictedControls: string[];
      disqualifiedStatus: string;
    };
    competitionName?: string;
    scorePoints: RogainingScorePoints;
    scoreReport: {
      sport: string;
      competitionName?: string;
      orderText: string;
      dateText?: string;
      placeName?: string;
      teamPlaceText: string;
      eventInfo: string;
      resultsTitle?: string;
      programName: string;
      departmentName: string;
      regionTableLayout: "groups" | "flat";
      regionGroups: {
        group1: string[];
        group2: string[];
        group3: string[];
        organizations: string[];
      };
      flatRegions: string[];
      signatures: {
        chiefJudgeTitle: string;
        departmentHeadTitle: string;
        sportResponsibleTitle: string;
        footerDateText: string;
      };
    };
    resultsReport: {
      headerLines: string[];
      title: string;
      programName: string;
      courseChief: string;
      controlCount?: number;
      controlTime: string;
      msuPlaces: number[];
      minRegionsForMsu: number;
    };
  };
  genderMapping: {
    menPrefixes: string[];
    womenPrefixes: string[];
    mixPrefixes: string[];
  };
  reportHeader: {
    title?: string;
    leftLogo?: string;
    rightLogo?: string;
    stage: string;
    region_of: string;
    location: string;
  };
  officials: OfficialsConfig;
};

const defaultConfig: AppConfig = {
  logging: {
    level: "debug",
  },
  ignoredStatuses: ["DidNotEnter"],
  individual: {
    scoring: "regular",
    classOrder: "name",
    teamResults: "none",
    teamFilterRegex: ".*",
    classFilterRegex: ".*",
    classOrderGroups: [
      {
        name: "ВВНЗ",
        classRegex: "ВВНЗ",
      },
      {
        name: "ЗСУ",
        classRegex: "ЗСУ",
      },
    ],
    reportTitle: "Індивідуальні результати",
  },
  "side-by-side": {
    teamRules: {
      menCount: 3,
      womenCount: 3,
    },
  },
  military: {
    teamFilterRegex: ".*",
    classFilterRegex: ".*",
    individualTeamGroups: [
      {
        name: "ВВНЗ",
        classRegex: "ВВНЗ",
      },
      {
        name: "ЗСУ",
        classRegex: "ЗСУ",
      },
    ],
  },
  rogaining: {
    controlGateRule: {
      enabled: false,
      gateControl: "22",
      restrictedControls: ["70", "87", "100", "30", "96", "110"],
      disqualifiedStatus: "disqualified",
    },
    scorePoints: {
      youthUnder18: {
        "1": 75,
        "2": 60,
        "3": 50,
        "4": 20,
        "5": 18,
        "6": 15,
        "7": 13,
        "8": 10,
      },
      youthUnder23: {
        "1": 150,
        "2": 125,
        "3": 100,
        "4": 40,
        "5": 30,
        "6": 25,
        "7": 18,
        "8": 13,
      },
      adult: {
        "1": 300,
        "2": 150,
        "3": 200,
        "4": 75,
        "5": 60,
        "6": 50,
        "7": 40,
        "8": 25,
      },
    },
    scoreReport: {
      sport: "спортивне орієнтування",
      orderText: "Наказ Мінмолодьспорту від __________________ № ______________",
      teamPlaceText: "_командного заліку не було__",
      eventInfo: "",
      programName: "рогейн",
      departmentName: "",
      regionTableLayout: "groups",
      regionGroups: {
        group1: [
          "м. Київ",
          "Харківська",
          "Дніпропетровська",
          "Донецька",
          "Запорізька",
          "Одеська",
          "Київська",
          "Луганська",
          "Львівська",
          "АР Крим",
        ],
        group2: [
          "Вінницька",
          "Полтавська",
          "Миколаївська",
          "Черкаська",
          "Чернігівська",
          "Івано-Франківська",
          "Херсонська",
        ],
        group3: [
          "Хмельницька",
          "Сумська",
          "м. Севастополь",
          "Чернівецька",
          "Рівненська",
          "Житомирська",
          "Кіровоградська",
          "Волинська",
          "Закарпатська",
          "Тернопільська",
        ],
        organizations: [
          "ФСТ \"Україна\"",
          "КФВС МОН України",
          "ФСТ \"Спартак\"",
          "ФСТ \"Динамо\"",
          "ФСТ \"Колос\"",
          "ТСО України",
          "ЗС України",
        ],
      },
      flatRegions: [
        "м. Київ",
        "Харківська",
        "Дніпропетровська",
        "Донецька",
        "Запорізька",
        "Одеська",
        "Київська",
        "Луганська",
        "Львівська",
        "Вінницька",
        "Хмельницька",
        "Сумська",
        "Черкаська",
        "Рівненська",
        "Чернівецька",
        "Житомирська",
        "Кіровоградська",
        "Волинська",
        "Закарпатська",
        "Тернопільська",
        "Полтавська",
        "Миколаївська",
        "Чернігівська",
        "Івано-Франківська",
        "Херсонська",
        "АР Крим",
        "м. Севастополь",
      ],
      signatures: {
        chiefJudgeTitle: "Головний суддя",
        departmentHeadTitle: "Начальник відділу",
        sportResponsibleTitle: "Відповідальний з виду спорту Мінмолодьспорту",
        footerDateText: "\"_________\" ____________________ 2026 рік",
      },
    },
    resultsReport: {
      headerLines: [
        "Міністерство молоді та спорту",
        "України Федерація спортивного",
        "орієнтування України",
      ],
      title: "ПРОТОКОЛ РЕЗУЛЬТАТІВ ЗМАГАНЬ З ОРІЄНТУВАННЯ",
      programName: "РОГЕЙН",
      courseChief: "",
      controlTime: "24:00:00",
      msuPlaces: [1, 2],
      minRegionsForMsu: 6,
    },
  },
  genderMapping: {
    menPrefixes: ["M", "Ч", "Х"],
    womenPrefixes: ["W", "Ж", "Д"],
    mixPrefixes: ["Mix", "Мікс", "Мікси"],
  },
  reportHeader: {
    stage: "ІІІ Етап",
    region_of: "Житомирського району",
    location: "м. Житомир",
  },
  officials: {
    chiefJudge: {
      name: "Іваненко І.В.",
    },
    chiefSecretary: {
      name: "Петренко О.А.",
    },
  },
};

let activeConfigPath: string | undefined;

const officialRoles = [
  "chiefJudge",
  "chiefSecretary",
  "joury1",
  "joury2",
  "joury3",
  "departmentHead",
  "sportResponsible",
] as const satisfies readonly OfficialRole[];

const legacySignatureFileFields: Record<OfficialRole, keyof RawOfficialsConfig> = {
  chiefJudge: "chiefJudgeSignatureFile",
  chiefSecretary: "chiefSecretarySignatureFile",
  joury1: "joury1SignatureFile",
  joury2: "joury2SignatureFile",
  joury3: "joury3SignatureFile",
  departmentHead: "departmentHeadSignatureFile",
  sportResponsible: "sportResponsibleSignatureFile",
};

export function setConfigPath(configPath?: string): void {
  activeConfigPath = configPath;
}

function mergeScorePoints(
  parsedScorePoints: RogainingScorePoints | undefined,
): RogainingScorePoints {
  if (!parsedScorePoints) {
    return defaultConfig.rogaining.scorePoints;
  }

  const categories: Array<keyof RogainingScorePoints> = [
    "youthUnder18",
    "youthUnder23",
    "adult",
    "masters",
  ];
  const scorePoints: RogainingScorePoints = {};

  for (const category of categories) {
    const parsedCategoryPoints = parsedScorePoints[category];

    if (!parsedCategoryPoints) {
      continue;
    }

    scorePoints[category] = {
      ...(defaultConfig.rogaining.scorePoints[category] ?? {}),
      ...parsedCategoryPoints,
    };
  }

  return scorePoints;
}

function resolveConfigAssetPath(assetPath: string, configFilePath: string): string {
  return path.isAbsolute(assetPath)
    ? assetPath
    : path.resolve(path.dirname(configFilePath), assetPath);
}

function normalizeOfficialPerson(
  rawOfficial: OfficialPersonInput | undefined,
  defaultOfficial?: OfficialPersonConfig,
  legacySignatureFile?: string,
): OfficialPersonConfig | undefined {
  if (rawOfficial === undefined && defaultOfficial === undefined && !legacySignatureFile) {
    return undefined;
  }

  const normalized: OfficialPersonConfig = {
    ...(defaultOfficial ?? { name: "" }),
  };

  if (typeof rawOfficial === "string") {
    normalized.name = rawOfficial;
  } else if (rawOfficial) {
    Object.assign(normalized, rawOfficial);
    normalized.name = rawOfficial.name ?? normalized.name;
  }

  if (legacySignatureFile !== undefined) {
    normalized.signatureFile = legacySignatureFile;
  }

  return normalized;
}

function normalizeOfficials(parsedOfficials?: RawOfficialsConfig): OfficialsConfig {
  const officials: OfficialsConfig = {
    chiefJudge: normalizeOfficialPerson(
      parsedOfficials?.chiefJudge,
      defaultConfig.officials.chiefJudge,
      parsedOfficials?.chiefJudgeSignatureFile,
    )!,
    chiefSecretary: normalizeOfficialPerson(
      parsedOfficials?.chiefSecretary,
      defaultConfig.officials.chiefSecretary,
      parsedOfficials?.chiefSecretarySignatureFile,
    )!,
  };

  for (const role of officialRoles) {
    if (role === "chiefJudge" || role === "chiefSecretary") {
      continue;
    }

    const person = normalizeOfficialPerson(
      parsedOfficials?.[role],
      defaultConfig.officials[role],
      parsedOfficials?.[legacySignatureFileFields[role]] as string | undefined,
    );

    if (person && (person.name || person.signatureFile || person.signatureImage)) {
      officials[role] = person;
    }
  }

  return officials;
}

function embedOfficialSignatureImages(
  officials: OfficialsConfig,
  configFilePath: string,
): OfficialsConfig {
  const resolvedOfficials: OfficialsConfig = {
    ...officials,
    chiefJudge: { ...officials.chiefJudge },
    chiefSecretary: { ...officials.chiefSecretary },
  };

  for (const role of officialRoles) {
    const official = resolvedOfficials[role];
    const signatureFile = official?.signatureFile;

    if (!signatureFile) {
      continue;
    }

    if (signatureFile.startsWith("data:image/")) {
      official.signatureImage = signatureFile;
      continue;
    }

    const signaturePath = resolveConfigAssetPath(signatureFile, configFilePath);

    if (!fs.existsSync(signaturePath)) {
      throw new Error(`Signature image not found at ${signaturePath}.`);
    }

    official.signatureImage = imageToBase64(signaturePath);
  }

  return resolvedOfficials;
}

function embedConfigImage(
  imagePath: string | undefined,
  configFilePath: string,
  label: string,
): string | undefined {
  const normalizedImagePath = imagePath?.trim();

  if (!normalizedImagePath) {
    return undefined;
  }

  if (normalizedImagePath.startsWith("data:image/")) {
    return normalizedImagePath;
  }

  const resolvedPath = resolveConfigAssetPath(normalizedImagePath, configFilePath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`${label} image not found at ${resolvedPath}.`);
  }

  return imageToBase64(resolvedPath);
}

function firstConfigImagePath(...imagePaths: Array<string | undefined>): string | undefined {
  for (const imagePath of imagePaths) {
    const normalizedImagePath = imagePath?.trim();

    if (normalizedImagePath) {
      return normalizedImagePath;
    }
  }

  return undefined;
}

export function loadConfig(configPath?: string): AppConfig {
  const filePath = configPath ?? activeConfigPath ?? path.resolve(process.cwd(), "config.json");

  if (!fs.existsSync(filePath)) {
    if (configPath || activeConfigPath) {
      throw new Error(`Config not found at ${filePath}.`);
    }

    console.warn(`Config not found at ${filePath}. Using default config.`);
    return defaultConfig;
  }

  const raw = fs.readFileSync(filePath, "utf-8");
  const parsed = JSON.parse(raw);

  return {
    ...defaultConfig,
    ...parsed,
    leftLogo: embedConfigImage(
      firstConfigImagePath(parsed.leftLogo, parsed.reportHeader?.leftLogo),
      filePath,
      "Left logo",
    ),
    rightLogo: embedConfigImage(
      firstConfigImagePath(parsed.rightLogo, parsed.reportHeader?.rightLogo),
      filePath,
      "Right logo",
    ),
    ignoredStatuses: parsed.ignoredStatuses ?? defaultConfig.ignoredStatuses,
    individual: {
      ...defaultConfig.individual,
      ...parsed.individual,
      teamFilterRegex:
        parsed.individual?.teamFilterRegex ??
        parsed.military?.teamFilterRegex ??
        defaultConfig.individual.teamFilterRegex,
      classFilterRegex:
        parsed.individual?.classFilterRegex ??
        parsed.military?.classFilterRegex ??
        defaultConfig.individual.classFilterRegex,
      classOrderGroups:
        parsed.individual?.classOrderGroups ??
        parsed.military?.individualTeamGroups ??
        defaultConfig.individual.classOrderGroups,
    },
    rogaining: {
      ...defaultConfig.rogaining,
      ...parsed.rogaining,
      controlGateRule: {
        ...defaultConfig.rogaining.controlGateRule,
        ...parsed.rogaining?.controlGateRule,
      },
      scorePoints: mergeScorePoints(parsed.rogaining?.scorePoints),
      scoreReport: {
        ...defaultConfig.rogaining.scoreReport,
        ...parsed.rogaining?.scoreReport,
        regionGroups: {
          ...defaultConfig.rogaining.scoreReport.regionGroups,
          ...parsed.rogaining?.scoreReport?.regionGroups,
          group1:
            parsed.rogaining?.scoreReport?.regionGroups?.group1 ??
            defaultConfig.rogaining.scoreReport.regionGroups.group1,
          group2:
            parsed.rogaining?.scoreReport?.regionGroups?.group2 ??
            defaultConfig.rogaining.scoreReport.regionGroups.group2,
          group3:
            parsed.rogaining?.scoreReport?.regionGroups?.group3 ??
            defaultConfig.rogaining.scoreReport.regionGroups.group3,
          organizations:
            parsed.rogaining?.scoreReport?.regionGroups?.organizations ??
            defaultConfig.rogaining.scoreReport.regionGroups.organizations,
        },
        signatures: {
          ...defaultConfig.rogaining.scoreReport.signatures,
          ...parsed.rogaining?.scoreReport?.signatures,
        },
        flatRegions:
          parsed.rogaining?.scoreReport?.flatRegions ??
          defaultConfig.rogaining.scoreReport.flatRegions,
      },
      resultsReport: {
        ...defaultConfig.rogaining.resultsReport,
        ...parsed.rogaining?.resultsReport,
        headerLines:
          parsed.rogaining?.resultsReport?.headerLines ??
          defaultConfig.rogaining.resultsReport.headerLines,
        msuPlaces:
          parsed.rogaining?.resultsReport?.msuPlaces ??
          defaultConfig.rogaining.resultsReport.msuPlaces,
      },
    },
    military: {
      ...defaultConfig.military,
      ...parsed.military,
    },
    genderMapping: {
      ...defaultConfig.genderMapping,
      ...parsed.genderMapping,
    },
    "side-by-side": {
      ...defaultConfig["side-by-side"],
      ...parsed["side-by-side"],
      teamRules: {
        ...defaultConfig["side-by-side"].teamRules,
        ...parsed.teamRules,
        ...parsed["side-by-side"]?.teamRules,
      },
    },
    reportHeader: {
      ...defaultConfig.reportHeader,
      ...parsed.reportHeader,
    },
    officials: embedOfficialSignatureImages(normalizeOfficials(parsed.officials), filePath),
  };
}
