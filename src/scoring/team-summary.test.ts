import { describe, expect, it } from "vitest";
import { buildTeamSummaryStandings } from "./team-summary";

describe("buildTeamSummaryStandings", () => {
  it("sums selected result sources by organisation", () => {
    const standings = buildTeamSummaryStandings([
      {
        key: "individual",
        label: "Індивідуальна",
        results: [
          { organisation: "Ліцей", points: 120 },
          { organisation: "Гімназія", points: 90 },
        ],
      },
      {
        key: "relay",
        label: "Естафета",
        results: [
          { organisation: "Ліцей", points: 200 },
          { organisation: "Школа", points: 95 },
        ],
      },
    ]);

    expect(standings).toEqual([
      {
        place: 1,
        organisation: "Ліцей",
        sourcePoints: [
          { key: "individual", label: "Індивідуальна", points: 120 },
          { key: "relay", label: "Естафета", points: 200 },
        ],
        totalPoints: 320,
      },
      {
        place: 2,
        organisation: "Школа",
        sourcePoints: [
          { key: "individual", label: "Індивідуальна", points: 0 },
          { key: "relay", label: "Естафета", points: 95 },
        ],
        totalPoints: 95,
      },
      {
        place: 3,
        organisation: "Гімназія",
        sourcePoints: [
          { key: "individual", label: "Індивідуальна", points: 90 },
          { key: "relay", label: "Естафета", points: 0 },
        ],
        totalPoints: 90,
      },
    ]);
  });

  it("uses source order as the tie breaker after total points", () => {
    const standings = buildTeamSummaryStandings([
      {
        key: "individual",
        label: "Індивідуальна",
        results: [
          { organisation: "А", points: 100 },
          { organisation: "Б", points: 90 },
        ],
      },
      {
        key: "relay",
        label: "Естафета",
        results: [
          { organisation: "А", points: 50 },
          { organisation: "Б", points: 60 },
        ],
      },
    ]);

    expect(standings.map((standing) => standing.organisation)).toEqual(["А", "Б"]);
  });
});
