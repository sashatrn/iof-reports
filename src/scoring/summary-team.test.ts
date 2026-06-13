import { describe, expect, it } from "vitest";
import { buildSummaryTeamStandingGroups } from "./summary-team";

describe("buildSummaryTeamStandingGroups", () => {
  const sources = [
    {
      key: "individual",
      label: "Індивідуальна",
      groups: [{
        results: [
          { organisation: "Ліцей", points: 120 },
          { organisation: "Гімназія", points: 90 },
        ],
      }],
    },
    {
      key: "relay",
      label: "Естафета",
      groups: [{
        results: [
          { organisation: "Ліцей", points: 200 },
          { organisation: "Школа", points: 95 },
        ],
      }],
    },
  ];

  it("sums flat sources by organisation", () => {
    const groups = buildSummaryTeamStandingGroups(sources, "flat");

    expect(groups).toHaveLength(1);
    expect(groups[0].standings.map((standing) => ({
      organisation: standing.organisation,
      totalPoints: standing.totalPoints,
    }))).toEqual([
      { organisation: "Ліцей", totalPoints: 320 },
      { organisation: "Школа", totalPoints: 95 },
      { organisation: "Гімназія", totalPoints: 90 },
    ]);
  });

  it("uses source order as the tie breaker after total points", () => {
    const groups = buildSummaryTeamStandingGroups([
      {
        key: "individual",
        label: "Індивідуальна",
        groups: [{ results: [
          { organisation: "А", points: 100 },
          { organisation: "Б", points: 90 },
        ] }],
      },
      {
        key: "relay",
        label: "Естафета",
        groups: [{ results: [
          { organisation: "А", points: 50 },
          { organisation: "Б", points: 60 },
        ] }],
      },
    ], "flat");

    expect(groups[0].standings.map((standing) => standing.organisation)).toEqual(["А", "Б"]);
  });

  it("keeps configured groups separate and ordered", () => {
    const groups = buildSummaryTeamStandingGroups([
      {
        key: "individual",
        label: "Індивідуальна",
        groups: [
          { name: "ЗСУ", results: [{ organisation: "СВ", points: 42 }] },
          { name: "ВВНЗ", results: [{ organisation: "ЖВІ", points: 45 }] },
        ],
      },
      {
        key: "relay",
        label: "Естафета",
        groups: [
          { name: "ВВНЗ", results: [{ organisation: "ЖВІ", points: 126 }] },
          { name: "ЗСУ", results: [{ organisation: "СВ", points: 111 }] },
        ],
      },
    ], "grouped", ["ВВНЗ", "ЗСУ"]);

    expect(groups.map((group) => group.name)).toEqual(["ВВНЗ", "ЗСУ"]);
    expect(groups[0].standings[0].totalPoints).toBe(171);
    expect(groups[1].standings[0].totalPoints).toBe(153);
  });
});
