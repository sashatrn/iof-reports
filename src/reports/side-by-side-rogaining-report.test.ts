import { describe, expect, it } from "vitest";
import { type Participant } from "../io/parse-iof";
import { buildSideBySideRogainingClasses } from "./side-by-side-rogaining-report";

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
        points: 1,
        timeBehind: "-16:40",
      },
      {
        position: "3",
        name: "Більше КП повільно",
        controlCount: "8",
        points: 1,
        timeBehind: "-13:20",
      },
      {
        position: "4",
        name: "Менше КП",
        controlCount: "4",
        points: 1,
        timeBehind: "-18:20",
      },
    ]);
  });
});

function makeParticipant(
  name: string,
  status: string,
  controlCount: number,
  timeSec: number,
): Participant {
  return {
    className: "Ж",
    name,
    club: "Ліцей",
    timeSec,
    status,
    points: 0,
    controlCount,
  };
}
