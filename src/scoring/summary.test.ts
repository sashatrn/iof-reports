import { describe, expect, it } from "vitest";
import { buildSummaryStandingGroups, type SummaryPointSource } from "./summary";

const sources: SummaryPointSource[] = [
  {
    key: "day1",
    label: "День 1",
    results: [
      { className: "Ч21Е", name: "Трухній Олександр", organisation: "КСО Коростишів", points: 900 },
      { className: "Ч21Е", name: "Інший учасник", organisation: "Клуб", points: 1000 },
    ],
  },
  {
    key: "day2",
    label: "День 2",
    results: [
      { className: "Ч21Е", name: " Трухній Олександр ", organisation: "Немає клубу", points: 950 },
      { className: "Ч21Е", name: "Інший учасник", organisation: "Клуб", points: 800 },
      { className: "Ч45", name: "Трухній Олександр", organisation: "КСО Коростишів", points: 700 },
    ],
  },
];

describe("individual summary matching", () => {
  it("combines points by name when organisations differ", () => {
    const groups = buildSummaryStandingGroups(sources, "name");
    const standings = groups.find((group) => group.name === "Ч21Е")!.standings;
    expect(standings).toHaveLength(2);
    expect(standings[0]).toMatchObject({
      place: 1, name: "Трухній Олександр", totalPoints: 1850, organisation: "КСО Коростишів",
    });
    expect(standings[0].sourcePoints.map((source) => source.points)).toEqual([900, 950]);
    expect(standings[1]).toMatchObject({ place: 2, name: "Інший учасник", totalPoints: 1800 });
  });

  it("keeps the same name in different classes separate", () => {
    const groups = buildSummaryStandingGroups(sources, "name");
    expect(groups.find((group) => group.name === "Ч45")!.standings).toMatchObject([
      { name: "Трухній Олександр", totalPoints: 700, sourcePoints: [{ points: 0 }, { points: 700 }] },
    ]);
  });

  it("preserves name and organisation matching by default", () => {
    const standings = buildSummaryStandingGroups(sources).find((group) => group.name === "Ч21Е")!.standings;
    expect(standings).toHaveLength(3);
    expect(standings.map((standing) => standing.totalPoints)).toEqual([1800, 950, 900]);
  });

  it.each([
    { clubs: ["Клуб А", "Unknown"], expected: "Клуб А" },
    { clubs: ["Unknown", "Клуб А"], expected: "Клуб А" },
    { clubs: ["Клуб А", " unknown "], expected: "Клуб А" },
    { clubs: ["Unknown", "Клуб А", "Клуб Б"], expected: "Клуб А" },
    { clubs: ["Клуб А", "Клуб Б", "Unknown"], expected: "Клуб А" },
    { clubs: ["", "Unknown", " Клуб А "], expected: "Клуб А" },
    { clubs: ["", "Unknown", "Немає клубу"], expected: "Unknown" },
    { clubs: ["Немає клубу", "Клуб А"], expected: "Клуб А" },
    { clubs: ["Клуб А", "Немає клубу"], expected: "Клуб А" },
  ])("keeps the first known club across days: $clubs", ({ clubs, expected }) => {
    const dailySources = clubs.map((organisation, index) => ({
      key: `day${index + 1}`,
      label: `День ${index + 1}`,
      results: [{ className: "Ч21Е", name: "Учасник", organisation, points: 1000 - index * 100 }],
    }));
    const standings = buildSummaryStandingGroups(dailySources, "name")[0].standings;
    expect(standings).toHaveLength(1);
    expect(standings[0].organisation).toBe(expected);
    expect(standings[0].sourcePoints.map((source) => source.points)).toEqual(
      clubs.map((_, index) => 1000 - index * 100),
    );
  });
});
