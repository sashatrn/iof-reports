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
