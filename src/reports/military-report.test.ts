import { describe, expect, it } from "vitest";
import { type Participant } from "../io/parse-iof";
import { type RogainingTeam } from "../io/parse-rogaining-iof";
import {
  buildMilitaryIndividualTeamResults,
  buildMilitaryRelayClasses,
  buildMilitaryRelayTeamResults,
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
      makeRelayTeam("Ч ВВНЗ", "Фініш", "ЖВІ", 3100, true, [1100, 1000, 1000]),
      makeRelayTeam("Ч ВВНЗ", "Два швидко", "ВА", 2200, false, [1000, 900]),
    ]);

    expect(classes[0].teams).toMatchObject([
      {
        teamName: "Фініш",
        place: "1",
        stageTimes: ["18:20", "16:40", "16:40"],
        status: "OK",
      },
      {
        teamName: "Два швидко",
        place: "",
        stageTimes: ["16:40", "15:00", ""],
        status: "DidNotFinish",
      },
      {
        teamName: "Два повільно",
        place: "",
        status: "DidNotFinish",
      },
      {
        teamName: "Один етап",
        place: "",
        status: "DidNotFinish",
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
): RogainingTeam {
  const members = memberTimeSecs?.map((_, index) => `${teamName} ${index + 1}`) ?? [teamName];

  return {
    className,
    teamName,
    organisation,
    members,
    memberTimeSecs,
    memberCount: members.length,
    score: 0,
    penalty: 0,
    totalScore: 0,
    timeSec,
    status: "OK",
    allMembersFinished,
  };
}
