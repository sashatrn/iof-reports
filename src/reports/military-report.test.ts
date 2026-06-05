import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { setConfigPath } from "../config";
import { type Participant } from "../io/parse-iof";
import { type TeamIofTeam } from "../io/parse-team-iof";
import {
  buildMilitaryIndividualTeamResults,
  buildMilitaryRelayClasses,
  buildMilitaryRelayHtml,
  buildMilitaryRelayTeamResults,
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

function getRowContaining(html: string, rowFragment: string): string {
  const fragmentIndex = html.indexOf(rowFragment);

  expect(fragmentIndex, `Expected row containing "${rowFragment}" to exist`).toBeGreaterThan(-1);

  const rowStart = html.lastIndexOf("<tr", fragmentIndex);
  const rowEnd = html.indexOf("</tr>", fragmentIndex);

  expect(rowStart).toBeGreaterThan(-1);
  expect(rowEnd).toBeGreaterThan(rowStart);

  return html.slice(rowStart, rowEnd + "</tr>".length);
}

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

describe("buildMilitaryRelayClasses", () => {
  it("scores only the first relay team from an organisation on the same distance", () => {
    const classes = buildMilitaryRelayClasses([
      makeRelayTeam("Ч ВВНЗ", "ЖВІ - 1", "ЖВІ", 3000),
      makeRelayTeam("Ч ВВНЗ", "ЖВІ - 2", "ЖВІ", 3100),
      makeRelayTeam("Ч ВВНЗ", "НАСВ - 1", "НАСВ", 3200),
      makeRelayTeam("Ж ВВНЗ", "ЖВІ - 1", "ЖВІ", 3300),
    ]);

    expect(classes.find((classGroup) => classGroup.name === "Ч ВВНЗ")?.teams).toMatchObject([
      {
        teamName: "ЖВІ - 1",
        place: "1",
        points: 126,
      },
      {
        teamName: "ЖВІ - 2",
        place: "2",
        points: 0,
      },
      {
        teamName: "НАСВ - 1",
        place: "3",
        points: 99,
      },
    ]);
    expect(classes.find((classGroup) => classGroup.name === "Ж ВВНЗ")?.teams).toMatchObject([
      {
        teamName: "ЖВІ - 1",
        place: "1",
        points: 126,
      },
    ]);
  });

  it("marks incomplete relay teams as DidNotFinish without place or points", () => {
    const classes = buildMilitaryRelayClasses([
      makeRelayTeam("Ч ВВНЗ", "ЖВІ - 1", "ЖВІ", 3000, true, [1000, 1000, 1000]),
      makeRelayTeam("Ч ВВНЗ", "ВІТВ - 2", "ВІТВ", 2900, false),
    ]);

    expect(classes[0].teams).toMatchObject([
      {
        teamName: "ЖВІ - 1",
        place: "1",
        points: 126,
        status: "OK",
      },
      {
        teamName: "ВІТВ - 2",
        place: "",
        points: 0,
        status: "DidNotFinish",
      },
    ]);
  });

  it("marks relay teams with missing stage times as DidNotFinish", () => {
    const classes = buildMilitaryRelayClasses([
      makeRelayTeam("Ж ВВНЗ", "ВА м.Одеса - 3", "ВА м.Одеса", 2460, true, [
        2460,
        undefined,
        undefined,
      ]),
    ]);

    expect(classes[0].teams).toMatchObject([
      {
        teamName: "ВА м.Одеса - 3",
        place: "",
        points: 0,
        stageTimes: ["41:00", "", ""],
        status: "DidNotFinish",
      },
    ]);
  });

  it("sorts relay teams by completed stages and cumulative stage time", () => {
    const classes = buildMilitaryRelayClasses([
      makeRelayTeam("Ч ВВНЗ", "Два повільно", "ВІТВ", 3000, false, [1200, 1000]),
      makeRelayTeam("Ч ВВНЗ", "Один етап", "НАСВ", 900, false, [900]),
      makeRelayTeam("Ч ВВНЗ", "Фініш", "ЖВІ", 3100, true, [900, 900, 1300]),
      makeRelayTeam("Ч ВВНЗ", "Два швидко", "ВА", 2200, false, [1000, 900]),
    ]);

    expect(classes[0].teams).toMatchObject([
      {
        teamName: "Фініш",
        place: "1",
        stageTimes: ["15:00", "15:00", "21:40"],
        timeBehind: "",
        status: "OK",
      },
      {
        teamName: "Два швидко",
        place: "",
        stageTimes: ["16:40", "15:00", ""],
        timeBehind: "+1:40",
        status: "DidNotFinish",
      },
      {
        teamName: "Два повільно",
        place: "",
        timeBehind: "+6:40",
        status: "DidNotFinish",
      },
      {
        teamName: "Один етап",
        place: "",
        timeBehind: "",
        status: "DidNotFinish",
      },
    ]);
  });

  it("formats negative relay time behind with a single minus sign", () => {
    const classes = buildMilitaryRelayClasses([
      makeRelayTeam("Ч ВВНЗ", "Знятий швидше", "ЖВІ", 2600, false, [
        800,
        900,
        900,
      ], "MissingPunch", ["OK", "OK", "MissingPunch"]),
      makeRelayTeam("Ч ВВНЗ", "Фініш", "ХНУПС", 3200, true, [1000, 1000, 1200]),
    ]);

    expect(classes[0].teams.find((team) => team.teamName === "Знятий швидше")).toMatchObject({
      timeBehind: "-10:00",
    });
  });

  it("leaves active relay stages empty", () => {
    const classes = buildMilitaryRelayClasses([
      makeRelayTeam("Ч ЗСУ", "СВ - 1", "СВ", 873, false, [
        873,
        undefined,
        undefined,
      ], "DidNotFinish", ["OK", "Active", "Inactive"]),
    ]);

    expect(classes[0].teams[0]).toMatchObject({
      teamName: "СВ - 1",
      stageTimes: ["14:33", "", ""],
      status: "Active",
      rowStatus: "ActiveWithResult",
    });
  });

  it("keeps active relay teams in view html but removes them from pdf html", () => {
    const teams = [
      makeRelayTeam("Ч ЗСУ", "Фініш", "СВ", 3000, true, [1000, 1000, 1000]),
      makeRelayTeam("Ч ЗСУ", "На дистанції", "СВ", 1000, false, [
        1000,
        undefined,
        undefined,
      ], "DidNotFinish", ["OK", "Active", "Inactive"]),
    ];

    const viewHtml = buildMilitaryRelayHtml(teams, new Date(2026, 3, 11), "view");
    const pdfHtml = buildMilitaryRelayHtml(teams, new Date(2026, 3, 11), "pdf");

    expect(viewHtml).toContain("На дистанції");
    expect(pdfHtml).not.toContain("На дистанції");
    expect(pdfHtml).not.toContain("Неактивний");
  });

  it("keeps fully inactive relay teams inactive even without stage times", () => {
    const classes = buildMilitaryRelayClasses([
      makeRelayTeam(
        "Ч ЗСУ",
        "Неактивні",
        "СВ",
        0,
        false,
        [undefined, undefined],
        "Inactive",
        ["Inactive", "Inactive"],
      ),
    ]);

    expect(classes[0].teams[0]).toMatchObject({
      teamName: "Неактивні",
      place: "",
      points: 0,
      status: "Inactive",
    });
  });

  it("calculates active relay time behind from the active stage leader", () => {
    const classes = buildMilitaryRelayClasses([
      makeRelayTeam(
        "Ч ЗСУ",
        "Лідер",
        "СВ",
        900,
        false,
        [900, undefined],
        "Active",
        ["OK", "Active"],
      ),
      makeRelayTeam(
        "Ч ЗСУ",
        "Переслідувач",
        "НАСВ",
        1000,
        false,
        [1000, undefined],
        "Active",
        ["OK", "Active"],
      ),
    ]);

    expect(classes[0].teams).toMatchObject([
      {
        teamName: "Лідер",
        timeBehind: "",
        status: "Active",
      },
      {
        teamName: "Переслідувач",
        timeBehind: "+1:40",
        status: "Active",
      },
    ]);
  });

  it("puts relay teams with a problem status after unfinished teams", () => {
    const classes = buildMilitaryRelayClasses([
      makeRelayTeam("Ч ВВНЗ", "MissingPunch", "ІВМС", 2600, false, [
        800,
        900,
        900,
      ], "MissingPunch", ["OK", "OK", "MissingPunch"]),
      makeRelayTeam("Ч ВВНЗ", "DidNotFinish", "ВІТВ", 3000, false, [1200, 1000]),
      makeRelayTeam("Ч ВВНЗ", "OK", "ЖВІ", 3100, true, [900, 900, 1300]),
    ]);

    expect(classes[0].teams).toMatchObject([
      {
        teamName: "OK",
        place: "1",
        points: 126,
        timeBehind: "",
        status: "OK",
      },
      {
        teamName: "DidNotFinish",
        place: "",
        points: 0,
        status: "DidNotFinish",
      },
      {
        teamName: "MissingPunch",
        place: "",
        points: 0,
        stageTimes: ["13:20", "15:00", "Не всі КП"],
        status: "MissingPunch",
      },
    ]);
  });

  it("keeps relay places but removes points for classes outside the class filter", () => {
    const classes = buildMilitaryRelayClasses(
      [
        makeRelayTeam("Ч ВВНЗ", "ЖВІ - 1", "ЖВІ", 3000, true, [1000, 1000, 1000]),
        makeRelayTeam("Ч ЗСУ", "СВ - 1", "СВ", 3100, true, [1000, 1000, 1100]),
      ],
      "ВВНЗ",
    );

    expect(classes.find((classGroup) => classGroup.name === "Ч ВВНЗ")?.teams).toMatchObject([
      {
        teamName: "ЖВІ - 1",
        place: "1",
        points: 126,
      },
    ]);
    expect(classes.find((classGroup) => classGroup.name === "Ч ЗСУ")?.teams).toMatchObject([
      {
        teamName: "СВ - 1",
        place: "1",
        points: 0,
      },
    ]);
  });

  it("renders stage columns from relay team member count", () => {
    const html = buildMilitaryRelayHtml(
      [
        makeRelayTeam("Ч ВВНЗ", "Чотири етапи", "ЖВІ", 4000, true, [
          900,
          1000,
          1000,
          1100,
        ]),
      ],
      new Date(2026, 3, 11),
      "view",
    );
    const row = getRowContaining(html, "Чотири етапи");

    expect(html).toContain("<th>Етап&nbsp;4</th>");
    expect(row).toContain("<td>18:20</td>");
  });
});

describe("buildMilitaryRelayTeamResults", () => {
  it("sums relay points by configured team groups", () => {
    const classes = buildMilitaryRelayClasses([
      makeRelayTeam("Ч ВВНЗ", "ЖВІ - 1", "ЖВІ", 3000),
      makeRelayTeam("Ч ВВНЗ", "ЖВІ - 2", "ЖВІ", 3100),
      makeRelayTeam("Ж ВВНЗ", "ЖВІ - 3", "ЖВІ", 3200),
      makeRelayTeam("Ч ЗСУ", "СВ - 1", "СВ", 3300),
      makeRelayTeam("Ч ЗСУ", "Клуб - 1", "Клуб", 3400),
    ]);

    expect(buildMilitaryRelayTeamResults(classes, "^(ЖВІ|СВ)$", ".*", teamGroups)).toEqual([
      {
        name: "ВВНЗ",
        teams: [
          {
            place: 1,
            organisation: "ЖВІ",
            points: 252,
          },
        ],
      },
      {
        name: "ЗСУ",
        teams: [
          {
            place: 1,
            organisation: "СВ",
            points: 126,
          },
        ],
      },
    ]);
  });

  it("skips relay team results outside the class filter", () => {
    const classes = buildMilitaryRelayClasses([
      makeRelayTeam("Ч ВВНЗ", "ЖВІ - 1", "ЖВІ", 3000, true, [1000, 1000, 1000]),
      makeRelayTeam("Ч ЗСУ", "СВ - 1", "СВ", 3300, true, [1100, 1100, 1100]),
    ]);

    expect(buildMilitaryRelayTeamResults(classes, ".*", "ВВНЗ", teamGroups)).toEqual([
      {
        name: "ВВНЗ",
        teams: [
          {
            place: 1,
            organisation: "ЖВІ",
            points: 126,
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
