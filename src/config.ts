import fs from "fs";
import path from "path";

export type AppConfig = {
  logging: {
    level: string;
  };
  rogaining: {
    controlGateRule: {
      enabled: boolean;
      gateControl: string;
      restrictedControls: string[];
      disqualifiedStatus: string;
    };
    scorePoints: {
      youthUnder18: Record<string, number>;
      youthUnder23: Record<string, number>;
      adult: Record<string, number>;
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
  };
};

const defaultConfig: AppConfig = {
  logging: {
    level: "debug",
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

export function loadConfig(configPath?: string): AppConfig {
  if (configPath) {
    console.log(`Loading config from ${configPath}`);
  }
  
  const filePath = configPath ?? path.resolve(process.cwd(), "config.json");

  if (!fs.existsSync(filePath)) {
    console.warn(`Config not found at ${filePath}. Using default config.`);
    return defaultConfig;
  }

  const raw = fs.readFileSync(filePath, "utf-8");
  const parsed = JSON.parse(raw);

  return {
    ...defaultConfig,
    ...parsed,
    rogaining: {
      ...defaultConfig.rogaining,
      ...parsed.rogaining,
      controlGateRule: {
        ...defaultConfig.rogaining.controlGateRule,
        ...parsed.rogaining?.controlGateRule,
      },
      scorePoints: {
        ...defaultConfig.rogaining.scorePoints,
        ...parsed.rogaining?.scorePoints,
        youthUnder18: {
          ...defaultConfig.rogaining.scorePoints.youthUnder18,
          ...parsed.rogaining?.scorePoints?.youthUnder18,
        },
        youthUnder23: {
          ...defaultConfig.rogaining.scorePoints.youthUnder23,
          ...parsed.rogaining?.scorePoints?.youthUnder23,
        },
        adult: {
          ...defaultConfig.rogaining.scorePoints.adult,
          ...parsed.rogaining?.scorePoints?.adult,
        },
      },
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
