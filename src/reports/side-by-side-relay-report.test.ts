import { describe, expect, it } from "vitest";
import { type RogainingTeam } from "../io/parse-rogaining-iof";
import {
  buildSideBySideRelayClasses,
  buildSideBySideRelayHtml,
  buildSideBySideRelayTeamResults,
} from "./side-by-side-relay-report";

function getRowContaining(html: string, rowFragment: string): string {
  const fragmentIndex = html.indexOf(rowFragment);

  expect(fragmentIndex, `Expected row containing "${rowFragment}" to exist`).toBeGreaterThan(-1);

  const rowStart = html.lastIndexOf("<tr", fragmentIndex);
  const rowEnd = html.indexOf("</tr>", fragmentIndex);

  expect(rowStart).toBeGreaterThan(-1);
  expect(rowEnd).toBeGreaterThan(rowStart);

  return html.slice(rowStart, rowEnd + "</tr>".length);
}

describe("buildSideBySideRelayClasses", () => {
  it("scores relay teams with side-by-side place points", () => {
    const classes = buildSideBySideRelayClasses([
      makeRelayTeam("Ч 5-6", "Ліцей 1", "Ліцей 1", 3000),
      makeRelayTeam("Ч 5-6", "Ліцей 1-2", "Ліцей 1", 3100),
      makeRelayTeam("Ч 5-6", "Ліцей 2", "Ліцей 2", 3200),
    ]);

    expect(classes[0].teams).toMatchObject([
      {
        teamName: "Ліцей 1",
        place: "1",
        points: 100,
      },
      {
        teamName: "Ліцей 1-2",
        place: "2",
        points: 95,
      },
      {
        teamName: "Ліцей 2",
        place: "3",
        points: 90,
      },
    ]);
  });

  it("keeps unfinished relay teams in progress order with side-by-side minimum points", () => {
    const classes = buildSideBySideRelayClasses([
      makeRelayTeam("Ж 7-8", "Фініш", "Гімназія", 3000, true, [1000, 1000, 1000]),
      makeRelayTeam("Ж 7-8", "Два етапи", "Ліцей", 1900, false, [900, 1000]),
    ]);

    expect(classes[0].teams).toMatchObject([
      {
        teamName: "Фініш",
        place: "1",
        points: 100,
        status: "OK",
      },
      {
        teamName: "Два етапи",
        place: "",
        points: 1,
        status: "DidNotFinish",
        timeBehind: "",
      },
    ]);
  });

  it("keeps active relay teams in view html but removes them from pdf html", () => {
    const teams = [
      makeRelayTeam("Ж 7-8", "Фініш", "Гімназія", 3000, true, [1000, 1000, 1000]),
      makeRelayTeam("Ж 7-8", "На дистанції", "Ліцей", 1000, false, [
        1000,
        undefined,
        undefined,
      ], "OK", ["OK", "Active", "Inactive"]),
    ];

    const viewHtml = buildSideBySideRelayHtml(teams, new Date(2026, 3, 11), "view");
    const pdfHtml = buildSideBySideRelayHtml(teams, new Date(2026, 3, 11), "pdf");

    expect(viewHtml).toContain("На дистанції");
    expect(pdfHtml).not.toContain("На дистанції");
    expect(pdfHtml).not.toContain("Неактивний");
  });

  it("does not score relay teams with active or inactive side-by-side status", () => {
    const teams = [
      makeRelayTeam("Ж 7-8", "Фініш", "Гімназія", 3000),
      makeRelayTeam(
        "Ж 7-8",
        "На дистанції",
        "Ліцей",
        3100,
        true,
        [1000, 1000, 1100],
        "Active",
      ),
      makeRelayTeam(
        "Ж 7-8",
        "Неактивні",
        "Школа",
        3200,
        true,
        [1000, 1000, 1200],
        "Inactive",
      ),
    ];
    const classes = buildSideBySideRelayClasses(teams);

    expect(classes[0].teams).toMatchObject([
      {
        teamName: "Фініш",
        points: 100,
      },
      {
        teamName: "На дистанції",
        place: "",
        points: 0,
        status: "Active",
      },
      {
        teamName: "Неактивні",
        place: "",
        points: 0,
        status: "Inactive",
      },
    ]);
    expect(buildSideBySideRelayTeamResults(classes)).toEqual([
      {
        place: 1,
        organisation: "Гімназія",
        points: 100,
      },
    ]);
    const html = buildSideBySideRelayHtml(teams, new Date(2026, 3, 11), "view");

    expect(getRowContaining(html, "На дистанції")).toMatch(
      /<td><strong><\/strong><\/td>\s*<td>На дистанції<\/td>/,
    );
    expect(getRowContaining(html, "Неактивні")).toMatch(
      /<td><strong><\/strong><\/td>\s*<td>Неактивний<\/td>/,
    );
  });
});

describe("buildSideBySideRelayTeamResults", () => {
  it("sums only the two best side-by-side relay points by organisation in each class", () => {
    const classes = buildSideBySideRelayClasses([
      makeRelayTeam("Ч 5-6", "Ліцей 1", "Ліцей 1", 3000),
      makeRelayTeam("Ч 5-6", "Ліцей 1-2", "Ліцей 1", 3100),
      makeRelayTeam("Ч 5-6", "Ліцей 1-3", "Ліцей 1", 3150),
      makeRelayTeam("Ж 5-6", "Ліцей 1", "Ліцей 1", 3000),
      makeRelayTeam("Ч 7-8", "Ліцей 1", "Ліцей 1", 3200),
      makeRelayTeam("Ч 5-6", "Ліцей 2", "Ліцей 2", 3200),
    ]);

    expect(buildSideBySideRelayTeamResults(classes)).toEqual([
      {
        place: 1,
        organisation: "Ліцей 1",
        points: 395,
      },
      {
        place: 2,
        organisation: "Ліцей 2",
        points: 85,
      },
    ]);
  });
});

function makeRelayTeam(
  className: string,
  teamName: string,
  organisation: string,
  timeSec: number,
  allMembersFinished = true,
  memberTimeSecs: Array<number | undefined> = [1000, 1000, timeSec - 2000],
  status = "OK",
  memberStatuses?: string[],
): RogainingTeam {
  const members = memberTimeSecs.map((_, index) => `${teamName} ${index + 1}`);

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
