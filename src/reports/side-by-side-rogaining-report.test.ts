import { describe, expect, it } from "vitest";
import { type Participant } from "../io/parse-iof";
import {
  buildSideBySideRogainingClasses,
  buildSideBySideRogainingTeamResults,
} from "./side-by-side-rogaining-report";

function getClassRows(participants: Participant[]) {
  return buildSideBySideRogainingClasses(participants)[0].participants;
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
    const rows = getClassRows([
      makeParticipant("Фініш", "OK", 10, 900),
      makeParticipant("На дистанції", "Active", 6, 1000, "Ж", "Ліцей 2"),
      makeParticipant("Неактивний", "Inactive", 0, 2000, "Ж", "Ліцей 3"),
    ]);

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
  });

  it("sums team results by organisation across classes", () => {
    const classes = buildSideBySideRogainingClasses([
      makeParticipant("Ліцей 1 швидко", "OK", 10, 900, "Ж", "Ліцей 1"),
      makeParticipant("Ліцей 2", "OK", 10, 1000, "Ж", "Ліцей 2"),
      makeParticipant("Ліцей 1 ще", "OK", 10, 800, "Ч", "Ліцей 1"),
    ]);

    expect(buildSideBySideRogainingTeamResults(classes)).toEqual([
      {
        place: 1,
        organisation: "Ліцей 1",
        points: 200,
      },
      {
        place: 2,
        organisation: "Ліцей 2",
        points: 95,
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
