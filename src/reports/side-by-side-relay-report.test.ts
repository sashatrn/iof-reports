import { describe, expect, it } from "vitest";
import { type RogainingTeam } from "../io/parse-rogaining-iof";
import {
  buildSideBySideRelayClasses,
  buildSideBySideRelayTeamResults,
} from "./side-by-side-relay-report";

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
});

describe("buildSideBySideRelayTeamResults", () => {
  it("sums side-by-side relay points by organisation", () => {
    const classes = buildSideBySideRelayClasses([
      makeRelayTeam("Ч 5-6", "Ліцей 1", "Ліцей 1", 3000),
      makeRelayTeam("Ж 5-6", "Ліцей 1", "Ліцей 1", 3100),
      makeRelayTeam("Ч 5-6", "Ліцей 2", "Ліцей 2", 3200),
    ]);

    expect(buildSideBySideRelayTeamResults(classes)).toEqual([
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
