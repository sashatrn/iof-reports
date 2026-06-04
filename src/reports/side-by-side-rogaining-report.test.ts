import { describe, expect, it } from "vitest";
import { type Participant } from "../io/parse-iof";
import {
  buildSideBySideRogainingClasses,
  buildSideBySideRogainingHtml,
  buildSideBySideRogainingTeamResults,
} from "./side-by-side-rogaining-report";

function getClassRows(participants: Participant[]) {
  return buildSideBySideRogainingClasses(participants)[0].participants;
}

function getRowContaining(html: string, rowFragment: string): string {
  const fragmentIndex = html.indexOf(rowFragment);

  expect(fragmentIndex, `Expected row containing "${rowFragment}" to exist`).toBeGreaterThan(-1);

  const rowStart = html.lastIndexOf("<tr", fragmentIndex);
  const rowEnd = html.indexOf("</tr>", fragmentIndex);

  expect(rowStart).toBeGreaterThan(-1);
  expect(rowEnd).toBeGreaterThan(rowStart);

  return html.slice(rowStart, rowEnd + "</tr>".length);
}

describe("buildSideBySideRogainingClasses", () => {
  it("orders OK participants by time", () => {
    const rows = getClassRows([
      makeParticipant("Повільний", "OK", 10, 1200),
      makeParticipant("Швидкий", "OK", 10, 900),
    ]);

    expect(rows).toMatchObject([
      {
        position: "1",
        name: "Швидкий",
        points: 100,
      },
      {
        position: "2",
        name: "Повільний",
        points: 95,
        timeBehind: "+5:00",
      },
    ]);
  });

  it("puts MissingPunch below OK and sorts by controls then time", () => {
    const rows = getClassRows([
      makeParticipant("OK", "OK", 5, 2000),
      makeParticipant("Менше КП", "MissingPunch", 4, 900),
      makeParticipant("Більше КП повільно", "MissingPunch", 8, 1200),
      makeParticipant("Більше КП швидко", "MissingPunch", 8, 1000),
    ]);

    expect(rows).toMatchObject([
      {
        position: "1",
        name: "OK",
        points: 100,
      },
      {
        position: "2",
        name: "Більше КП швидко",
        controlCount: "8",
        points: 95,
        timeBehind: "-16:40",
      },
      {
        position: "3",
        name: "Більше КП повільно",
        controlCount: "8",
        points: 90,
        timeBehind: "-13:20",
      },
      {
        position: "4",
        name: "Менше КП",
        controlCount: "4",
        points: 85,
        timeBehind: "-18:20",
      },
    ]);
  });

  it("does not score active or inactive participants", () => {
    const participants = [
      makeParticipant("Фініш", "OK", 10, 900),
      makeParticipant("На дистанції", "Active", 6, 1000, "Ж", "Ліцей 2"),
      makeParticipant("Неактивний", "Inactive", 1, 2000, "Ж", "Ліцей 3"),
    ];
    const rows = getClassRows(participants);

    expect(rows).toMatchObject([
      {
        name: "Фініш",
        points: 100,
      },
      {
        name: "На дистанції",
        points: 0,
        status: "Active",
      },
      {
        name: "Неактивний",
        points: 0,
        status: "Inactive",
      },
    ]);

    expect(buildSideBySideRogainingTeamResults([{ name: "Ж", participants: rows }])).toEqual([
      {
        place: 1,
        organisation: "Ліцей",
        points: 100,
      },
    ]);

    const html = buildSideBySideRogainingHtml(participants, new Date(2026, 3, 11), "view");

    expect(getRowContaining(html, "На дистанції")).toMatch(
      /<td><\/td>\s*<td>На дистанції<\/td>/,
    );
    expect(getRowContaining(html, "Неактивний")).toMatch(
      /<td><\/td>\s*<td>Неактивний<\/td>/,
    );
  });

  it("sums only the two best team results by organisation in each class", () => {
    const classes = buildSideBySideRogainingClasses([
      makeParticipant("Ліцей 1 швидко", "OK", 10, 900, "Ж", "Ліцей 1"),
      makeParticipant("Ліцей 2", "OK", 10, 1000, "Ж", "Ліцей 2"),
      makeParticipant("Ліцей 1 другий Ж", "OK", 10, 950, "Ж", "Ліцей 1"),
      makeParticipant("Ліцей 1 третій Ж", "OK", 10, 990, "Ж", "Ліцей 1"),
      makeParticipant("Ліцей 1 ще", "OK", 10, 800, "Ч", "Ліцей 1"),
      makeParticipant("Ліцей 1 третій", "OK", 10, 850, "Ч", "Ліцей 1"),
    ]);

    expect(buildSideBySideRogainingTeamResults(classes)).toEqual([
      {
        place: 1,
        organisation: "Ліцей 1",
        points: 390,
      },
      {
        place: 2,
        organisation: "Ліцей 2",
        points: 85,
      },
    ]);
  });
});

function makeParticipant(
  name: string,
  status: string,
  controlCount: number,
  timeSec: number,
  className = "Ж",
  club = "Ліцей",
): Participant {
  return {
    className,
    name,
    club,
    timeSec,
    status,
    points: 0,
    controlCount,
  };
}
