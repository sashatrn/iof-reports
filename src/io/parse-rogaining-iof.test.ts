import { describe, expect, it } from "vitest";
import { parseRogainingIof } from "./parse-rogaining-iof";

describe("parseRogainingIof", () => {
  it("treats Score as already final and does not subtract penalty twice", () => {
    const parsed = parseRogainingIof(`
      <ResultList>
        <Event>
          <StartTime>
            <Date>2026-04-25</Date>
          </StartTime>
        </Event>
        <ClassResult>
          <Class>
            <Name>Ч</Name>
          </Class>
          <TeamResult>
            <Name>Тотус</Name>
            <Organisation>
              <Name>No club</Name>
            </Organisation>
            <TeamMemberResult>
              <Person>
                <Name>
                  <Family>Сергій</Family>
                  <Given>Гераськін</Given>
                </Name>
              </Person>
              <Organisation>
                <Name>No club</Name>
              </Organisation>
              <Result>
                <Time>14464</Time>
                <Status>OK</Status>
                <Score type="Score">84</Score>
                <Score type="Penalty">2</Score>
                <OverallResult>
                  <Time>14464</Time>
                  <Status>OK</Status>
                </OverallResult>
              </Result>
            </TeamMemberResult>
          </TeamResult>
        </ClassResult>
      </ResultList>
    `);
    const team = parsed.teams.find((entry) => entry.teamName === "Тотус");

    expect(team).toBeDefined();
    expect(team?.score).toBe(84);
    expect(team?.penalty).toBe(2);
    expect(team?.totalScore).toBe(84);
  });

  it("joins unique member regions in participant order", () => {
    const parsed = parseRogainingIof(`
      <ResultList>
        <ClassResult>
          <Class>
            <Name>МІКС</Name>
          </Class>
          <TeamResult>
            <Name>Збірна</Name>
            <Organisation>
              <Name>Київська</Name>
            </Organisation>
            <TeamMemberResult>
              <Person>
                <Name>
                  <Family>Олена</Family>
                  <Given>Кравчук</Given>
                </Name>
              </Person>
              <Organisation>
                <Name>Київська</Name>
              </Organisation>
              <Result>
                <Status>OK</Status>
                <Score type="Score">30</Score>
                <Score type="Penalty">0</Score>
              </Result>
            </TeamMemberResult>
            <TeamMemberResult>
              <Person>
                <Name>
                  <Family>Ігор</Family>
                  <Given>Бондар</Given>
                </Name>
              </Person>
              <Organisation>
                <Name>Львівська</Name>
              </Organisation>
              <Result>
                <Status>OK</Status>
                <Score type="Score">30</Score>
                <Score type="Penalty">0</Score>
              </Result>
            </TeamMemberResult>
            <TeamMemberResult>
              <Person>
                <Name>
                  <Family>Анна</Family>
                  <Given>Мельник</Given>
                </Name>
              </Person>
              <Organisation>
                <Name>Київська</Name>
              </Organisation>
              <Result>
                <Status>OK</Status>
                <Score type="Score">30</Score>
                <Score type="Penalty">0</Score>
              </Result>
            </TeamMemberResult>
          </TeamResult>
        </ClassResult>
      </ResultList>
    `);

    expect(parsed.teams).toHaveLength(1);
    expect(parsed.teams[0].organisation).toBe("Київська, Львівська");
    expect(parsed.teams[0].memberOrganisations).toEqual([
      "Київська",
      "Львівська",
      "Київська",
    ]);
  });
});
