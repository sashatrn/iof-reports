import fs from "fs";
import path from "path";

type RogainingScorePoints = {
  youthUnder18?: Record<string, number>;
  youthUnder23?: Record<string, number>;
  adult?: Record<string, number>;
  masters?: Record<string, number>;
};

export type MilitaryIndividualTeamGroupConfig = {
  name: string;
  classRegex: string;
};

export type AppConfig = {
  logging: {
    level: string;
  };
  ignoredStatuses: string[];
  military: {
    teamFilterRegex: string;
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
  teamRules: {
    menCount: number;
    womenCount: number;
  };
  reportHeader: {
    title?: string;
    stage: string;
    region_of: string;
    location: string;
  };
  officials: {
    chiefJudge: string;
    chiefSecretary: string;
    joury1?: string;
    joury2?: string;
    joury3?: string;
  };
};

const defaultConfig: AppConfig = {
  logging: {
    level: "debug",
  },
  ignoredStatuses: ["DidNotEnter"],
  military: {
    teamFilterRegex: ".*",
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
  teamRules: {
    menCount: 3,
    womenCount: 3,
  },
  reportHeader: {
    stage: "ІІІ Етап",
    region_of: "Житомирського району",
    location: "м. Житомир",
  },
  officials: {
    chiefJudge: "Іваненко І.В.",
    chiefSecretary: "Петренко О.А.",
  },
};

let activeConfigPath: string | undefined;

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
    ignoredStatuses: parsed.ignoredStatuses ?? defaultConfig.ignoredStatuses,
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
    teamRules: {
      ...defaultConfig.teamRules,
      ...parsed.teamRules,
    },
    reportHeader: {
      ...defaultConfig.reportHeader,
      ...parsed.reportHeader,
    },
    officials: {
      ...defaultConfig.officials,
      ...parsed.officials,
    },
  };
}
