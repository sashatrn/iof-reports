import { describe, expect, it } from "vitest";
import { type TeamIofTeam } from "../io/parse-team-iof";
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
        points: 300,
      },
      {
        teamName: "Ліцей 1-2",
        place: "2",
        points: 285,
      },
      {
        teamName: "Ліцей 2",
        place: "3",
        points: 270,
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
        points: 300,
        status: "OK",
      },
      {
        teamName: "Два етапи",
        place: "",
        points: 2,
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
        points: 300,
      },
      {
        teamName: "На дистанції",
        place: "",
        points: 0,
        status: "Active",
        rowStatus: "ActiveWithResult",
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
        points: 300,
      },
    ]);
    const html = buildSideBySideRelayHtml(teams, new Date(2026, 3, 11), "view");

    expect(getRowContaining(html, "На дистанції")).toMatch(
      /<td><strong><\/strong><\/td>\s*<td>На дистанції<\/td>/,
    );
    expect(getRowContaining(html, "На дистанції")).toContain('data-status="ActiveWithResult"');
    expect(getRowContaining(html, "Неактивні")).toMatch(
      /<td><strong><\/strong><\/td>\s*<td>Неактивний<\/td>/,
    );
  });

  it("keeps fully inactive relay teams inactive even without stage times", () => {
    const classes = buildSideBySideRelayClasses([
      makeRelayTeam(
        "Ж 9",
        "Неактивні",
        "Ліцей",
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

  it("keeps stage cells empty for inactive relay members", () => {
    const classes = buildSideBySideRelayClasses([
      makeRelayTeam(
        "Ж 9",
        "Неактивні",
        "Ліцей",
        0,
        false,
        [undefined, undefined],
        "Inactive",
        ["Inactive", "Inactive"],
      ),
    ]);

    expect(classes[0].teams[0].stageTimes).toEqual(["", ""]);
  });

  it("marks only active relay teams without finished stages as hideable active rows", () => {
    const html = buildSideBySideRelayHtml(
      [
        makeRelayTeam(
          "Ж 9",
          "Ще ніхто",
          "Ліцей",
          0,
          false,
          [undefined, undefined],
          "Active",
          ["Active", "Inactive"],
        ),
        makeRelayTeam(
          "Ж 9",
          "Є фінішер",
          "Гімназія",
          900,
          false,
          [900, undefined],
          "Active",
          ["OK", "Active"],
        ),
      ],
      new Date(2026, 3, 11),
      "view",
    );

    expect(getRowContaining(html, "Ще ніхто")).toContain('data-status="Active"');
    expect(getRowContaining(html, "Є фінішер")).toContain('data-status="ActiveWithResult"');
  });

  it("calculates active relay time behind from the active stage leader", () => {
    const classes = buildSideBySideRelayClasses([
      makeRelayTeam(
        "Ж 9",
        "Лідер",
        "Ліцей",
        900,
        false,
        [900, undefined],
        "Active",
        ["OK", "Active"],
      ),
      makeRelayTeam(
        "Ж 9",
        "Переслідувач",
        "Гімназія",
        1000,
        false,
        [1000, undefined],
        "Active",
        ["OK", "Active"],
      ),
      makeRelayTeam(
        "Ж 9",
        "Ще не старт",
        "Школа",
        0,
        false,
        [undefined, undefined],
        "Active",
        ["Active", "Inactive"],
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
      {
        teamName: "Ще не старт",
        timeBehind: "",
        status: "Active",
      },
    ]);
  });

  it("renders stage columns from relay team member count", () => {
    const html = buildSideBySideRelayHtml(
      [
        makeRelayTeam("Ж 9", "Два етапи", "Ліцей", 1900, true, [900, 1000]),
      ],
      new Date(2026, 3, 11),
      "view",
    );
    const row = getRowContaining(html, "Два етапи");

    expect(html).toContain("<th>Етап&nbsp;1</th>");
    expect(html).toContain("<th>Етап&nbsp;2</th>");
    expect(html).not.toContain("<th>Етап&nbsp;3</th>");
    expect(row).toContain("<td>15:00</td>");
    expect(row).toContain("<td>16:40</td>");
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
            points: 1185,
          },
          {
            place: 2,
            organisation: "Ліцей 2",
            points: 255,
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
): TeamIofTeam {
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
