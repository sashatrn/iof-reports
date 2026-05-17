import { describe, expect, it } from "vitest";
import { type Participant } from "../io/parse-iof";
import { buildMilitaryIndividualTeamResults } from "./military-report";

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

    expect(buildMilitaryIndividualTeamResults(participants, "^ВЧ", teamGroups)).toEqual([
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

    expect(buildMilitaryIndividualTeamResults(participants, ".*", teamGroups)).toEqual([
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
      buildMilitaryIndividualTeamResults(participants, ".*", [
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
