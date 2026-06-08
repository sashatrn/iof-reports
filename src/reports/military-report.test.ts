import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { setConfigPath } from "../config";
import { type Participant } from "../io/parse-iof";
import { type TeamIofTeam } from "../io/parse-team-iof";
import {
  buildMilitaryIndividualTeamResults,
  buildMilitaryTeamStandingGroups,
  buildMilitaryTeamStandings,
} from "./military-report";

const teamGroups = [
  {
    name: "ВВНЗ",
    classRegex: "ВВНЗ",
  },
  {
    name: "ЗСУ",
    classRegex: "ЗСУ",
  },
];

afterEach(() => {
  setConfigPath(undefined);
});

describe("buildMilitaryIndividualTeamResults", () => {
  it("sums only organisations matching the military team filter", () => {
    const participants: Participant[] = [
      makeParticipant("ВЧ А1000", 45),
      makeParticipant("ВЧ А1000", 42),
      makeParticipant("Клуб", 40),
      makeParticipant("ВЧ Б2000", 38),
    ];

    expect(buildMilitaryIndividualTeamResults(participants, "^ВЧ", ".*", teamGroups)).toEqual([
      {
        name: "ВВНЗ",
        teams: [
          {
            place: 1,
            organisation: "ВЧ А1000",
            points: 87,
          },
          {
            place: 2,
            organisation: "ВЧ Б2000",
            points: 38,
          },
        ],
      },
    ]);
  });

  it("separates military individual team results by ВВНЗ and ЗСУ groups", () => {
    const participants: Participant[] = [
      makeParticipant("НАСВ", 45, "Ч ВВНЗ"),
      makeParticipant("НАСВ", 42, "Ж ВВНЗ"),
      makeParticipant("СВ", 40, "Ч ЗСУ"),
      makeParticipant("СВ", 38, "Ж ЗСУ"),
    ];

    expect(buildMilitaryIndividualTeamResults(participants, ".*", ".*", teamGroups)).toEqual([
      {
        name: "ВВНЗ",
        teams: [
          {
            place: 1,
            organisation: "НАСВ",
            points: 87,
          },
        ],
      },
      {
        name: "ЗСУ",
        teams: [
          {
            place: 1,
            organisation: "СВ",
            points: 78,
          },
        ],
      },
    ]);
  });

  it("uses configured class regexes for military team groups", () => {
    const participants: Participant[] = [
      makeParticipant("Команда A", 45, "Long A"),
      makeParticipant("Команда B", 42, "Long B"),
    ];

    expect(
      buildMilitaryIndividualTeamResults(participants, ".*", ".*", [
        {
          name: "Група A",
          classRegex: "A$",
        },
        {
          name: "Група B",
          classRegex: "B$",
        },
      ]),
    ).toEqual([
      {
        name: "Група A",
        teams: [
          {
            place: 1,
            organisation: "Команда A",
            points: 45,
          },
        ],
      },
      {
        name: "Група B",
        teams: [
          {
            place: 1,
            organisation: "Команда B",
            points: 42,
          },
        ],
      },
    ]);
  });

  it("sums only classes matching the military class filter", () => {
    const participants: Participant[] = [
      makeParticipant("НАСВ", 45, "Ч ВВНЗ"),
      makeParticipant("НАСВ", 42, "Ж ВВНЗ"),
      makeParticipant("СВ", 40, "Ч ЗСУ"),
    ];

    expect(buildMilitaryIndividualTeamResults(participants, ".*", "ВВНЗ", teamGroups)).toEqual([
      {
        name: "ВВНЗ",
        teams: [
          {
            place: 1,
            organisation: "НАСВ",
            points: 87,
          },
        ],
      },
    ]);
  });
});

describe("buildMilitaryTeamStandings", () => {
  it("includes only organisations matching the military team filter", () => {
    const configPath = writeTempConfig({
      military: {
        teamFilterRegex: "^ЖВІ$",
        classFilterRegex: ".*",
        individualTeamGroups: teamGroups,
      },
    });
    setConfigPath(configPath);

    const standings = buildMilitaryTeamStandings(
      [
        makeParticipant("ЖВІ", 45, "Ч ВВНЗ"),
        makeParticipant("Клуб", 42, "Ч ВВНЗ"),
      ],
      [
        makeRelayTeam("Ч ВВНЗ", "ЖВІ - 1", "ЖВІ", 3000, true, [1000, 1000, 1000]),
        makeRelayTeam("Ч ВВНЗ", "Клуб - 1", "Клуб", 2900, true, [900, 1000, 1000]),
      ],
    );

    expect(standings).toHaveLength(1);
    expect(standings[0]).toMatchObject({
      organisation: "ЖВІ",
      individualPoints: 45,
      relayPoints: 111,
      totalPoints: 156,
    });
  });

  it("applies the military team filter after normalising empty organisations to Unknown", () => {
    const configPath = writeTempConfig({
      military: {
        teamFilterRegex: "^(?!.*Unknown).*$",
        classFilterRegex: ".*",
        individualTeamGroups: teamGroups,
      },
    });
    setConfigPath(configPath);

    const standings = buildMilitaryTeamStandings(
      [makeParticipant(" ", 45, "Ч ВВНЗ"), makeParticipant("ЖВІ", 42, "Ч ВВНЗ")],
      [],
    );

    expect(standings).toEqual([
      {
        place: 1,
        organisation: "ЖВІ",
        individualPoints: 42,
        relayPoints: 0,
        totalPoints: 42,
      },
    ]);
  });
});

describe("buildMilitaryTeamStandingGroups", () => {
  it("splits overall military team standings by configured class groups", () => {
    const configPath = writeTempConfig({
      military: {
        teamFilterRegex: ".*",
        classFilterRegex: ".*",
        individualTeamGroups: teamGroups,
      },
    });
    setConfigPath(configPath);

    const groups = buildMilitaryTeamStandingGroups(
      [
        makeParticipant("ЖВІ", 45, "Ч ВВНЗ"),
        makeParticipant("СВ", 42, "Ч ЗСУ"),
      ],
      [
        makeRelayTeam("Ч ВВНЗ", "ЖВІ - 1", "ЖВІ", 3000, true, [1000, 1000, 1000]),
        makeRelayTeam("Ч ЗСУ", "СВ - 1", "СВ", 3100, true, [1000, 1000, 1100]),
      ],
    );

    expect(groups).toEqual([
      {
        name: "ВВНЗ",
        standings: [
          {
            place: 1,
            organisation: "ЖВІ",
            individualPoints: 45,
            relayPoints: 126,
            totalPoints: 171,
          },
        ],
      },
      {
        name: "ЗСУ",
        standings: [
          {
            place: 1,
            organisation: "СВ",
            individualPoints: 42,
            relayPoints: 126,
            totalPoints: 168,
          },
        ],
      },
    ]);
  });
});

function makeParticipant(club: string, points: number, className = "Ч ВВНЗ"): Participant {
  return {
    className,
    name: `${club} athlete`,
    club,
    status: "OK",
    points,
  };
}

function makeRelayTeam(
  className: string,
  teamName: string,
  organisation: string,
  timeSec: number,
  allMembersFinished = true,
  memberTimeSecs?: Array<number | undefined>,
  status = "OK",
  memberStatuses?: string[],
): TeamIofTeam {
  const members = memberTimeSecs?.map((_, index) => `${teamName} ${index + 1}`) ?? [teamName];

  return {
    className,
    teamName,
    organisation,
    members,
    memberTimeSecs,
    memberStatuses,
    memberCount: members.length,
    score: 0,
    penalty: 0,
    totalScore: 0,
    timeSec,
    status,
    allMembersFinished,
  };
}

function writeTempConfig(config: unknown): string {
  const configPath = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), "iof-reports-test-")),
    "config.json",
  );

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  return configPath;
}
