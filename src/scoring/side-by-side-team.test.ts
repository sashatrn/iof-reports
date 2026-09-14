import path from "path";
import { describe, expect, it } from "vitest";
import { loadConfig } from "../config";
import { type Participant } from "../io/parse-iof";
import {
  buildSideBySideIndividualTeamResults,
  buildSideBySideTeamResultsFromEntries,
} from "./side-by-side-team";

const config = loadConfig(path.resolve(__dirname, "../../config-summary-team-side-by-side.json"));

function participant(
  className: string,
  name: string,
  club: string,
  place: number,
  points: number,
): Participant {
  return {
    className,
    name,
    club,
    position: place,
    status: "OK",
    points,
  };
}

describe("2026 side-by-side team rules", () => {
  it("takes six mixed results for 5-9 and four for 9-12", () => {
    const results = buildSideBySideIndividualTeamResults([
      participant("Ч 5-6", "A1", "Ліцей", 1, 100),
      participant("Ж 5-6", "A2", "Ліцей", 2, 95),
      participant("Ч 7-8", "A3", "Ліцей", 3, 90),
      participant("Ж 7-8", "A4", "Ліцей", 4, 85),
      participant("Ч 9", "A5", "Ліцей", 5, 84),
      participant("Ж 9", "A6", "Ліцей", 6, 83),
      participant("Ж 9", "A7", "Ліцей", 7, 82),
      participant("Ч 9-10", "B1", "Гімназія", 1, 100),
      participant("Ж 9-10", "B2", "Гімназія", 2, 95),
      participant("Ч 11-12", "B3", "Гімназія", 3, 90),
      participant("Ж 11-12", "B4", "Гімназія", 4, 85),
      participant("Ж 11-12", "B5", "Гімназія", 5, 84),
      participant("Тестова", "Test", "Тестовий клуб", 1, 1000),
      participant("Поза конкурсом", "Open", "Інший клуб", 1, 1000),
    ], config);

    expect(results).toMatchObject([
      {
        name: "5-9 класи",
        teams: [{ organisation: "Ліцей", points: 537 }],
      },
      {
        name: "9-12 класи",
        teams: [{ organisation: "Гімназія", points: 370 }],
      },
    ]);
    expect(results.flatMap((group) => group.teams)).toHaveLength(2);
  });

  it("uses counted places as the tie-break and keeps exact ties", () => {
    const results = buildSideBySideIndividualTeamResults([
      participant("Ч 5-6", "A1", "А", 1, 100),
      participant("Ж 5-6", "A2", "А", 5, 84),
      participant("Ч 5-6", "B1", "Б", 2, 95),
      participant("Ж 5-6", "B2", "Б", 3, 89),
      participant("Ч 5-6", "C1", "В", 1, 100),
      participant("Ж 5-6", "C2", "В", 5, 84),
    ], config);

    expect(results[0].teams.map(({ organisation, place }) => ({ organisation, place })))
      .toEqual([
        { organisation: "А", place: 1 },
        { organisation: "В", place: 1 },
        { organisation: "Б", place: 3 },
      ]);
  });

  it("takes three relay teams for 5-9 and two for 9-12", () => {
    const results = buildSideBySideTeamResultsFromEntries([
      ...[200, 190, 180, 170].map((points, index) => ({
        className: index < 2 ? "5-6" : "7-8",
        organisation: "Ліцей",
        label: `Young ${index + 1}`,
        place: index + 1,
        points,
      })),
      ...[200, 190, 180].map((points, index) => ({
        className: index < 2 ? "9-10" : "11-12",
        organisation: "Гімназія",
        label: `Senior ${index + 1}`,
        place: index + 1,
        points,
      })),
      {
        className: "Тестова",
        organisation: "Тестовий клуб",
        label: "Test",
        place: 1,
        points: 1000,
      },
    ], config, "relay");

    expect(results).toMatchObject([
      { name: "5-9 класи", teams: [{ organisation: "Ліцей", points: 570 }] },
      { name: "9-12 класи", teams: [{ organisation: "Гімназія", points: 390 }] },
    ]);
  });
});
