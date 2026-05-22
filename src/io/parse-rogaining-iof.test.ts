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
                <SplitTime status="Additional">
                  <ControlCode>31</ControlCode>
                  <Time>120</Time>
                </SplitTime>
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
    expect(team?.memberSplits).toEqual([[{ controlCode: "31", timeSec: 120 }]]);
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

  it("uses team organisation before member organisations", () => {
    const parsed = parseRogainingIof(`
      <ResultList>
        <ClassResult>
          <Class>
            <Name>Ж ВВНЗ</Name>
          </Class>
          <TeamResult>
            <Name>ВА м.Одеса - 3</Name>
            <Organisation>
              <Name>ВА м.Одеса</Name>
            </Organisation>
            <TeamMemberResult>
              <Person>
                <Name>
                  <Family></Family>
                  <Given>X</Given>
                </Name>
              </Person>
              <Organisation>
                <Name>ХНУПС</Name>
              </Organisation>
              <Result>
                <Status>OK</Status>
                <OverallResult>
                  <Time>2460</Time>
                  <Status>OK</Status>
                </OverallResult>
              </Result>
            </TeamMemberResult>
          </TeamResult>
        </ClassResult>
      </ResultList>
    `);

    expect(parsed.teams[0].teamName).toBe("ВА м.Одеса - 3");
    expect(parsed.teams[0].organisation).toBe("ВА м.Одеса");
    expect(parsed.teams[0].memberOrganisations).toEqual(["ХНУПС"]);
  });

  it("excludes DidNotEnter team members and empty teams", () => {
    const parsed = parseRogainingIof(`
      <ResultList>
        <ClassResult>
          <Class>
            <Name>Естафета</Name>
          </Class>
          <TeamResult>
            <Name>Не стартували</Name>
            <TeamMemberResult>
              <Person>
                <Name>
                  <Family>Неявка</Family>
                  <Given>Учасник</Given>
                </Name>
              </Person>
              <Result>
                <Status>DidNotEnter</Status>
                <OverallResult>
                  <Status>DidNotEnter</Status>
                </OverallResult>
              </Result>
            </TeamMemberResult>
          </TeamResult>
          <TeamResult>
            <Name>Фінішували</Name>
            <TeamMemberResult>
              <Person>
                <Name>
                  <Family>Перший</Family>
                  <Given>Учасник</Given>
                </Name>
              </Person>
              <Organisation>
                <Name>Команда</Name>
              </Organisation>
              <Result>
                <Status>OK</Status>
                <OverallResult>
                  <Time>3600</Time>
                  <Status>OK</Status>
                </OverallResult>
              </Result>
            </TeamMemberResult>
            <TeamMemberResult>
              <Person>
                <Name>
                  <Family>Неявка</Family>
                  <Given>Другий</Given>
                </Name>
              </Person>
              <Result>
                <Status>DidNotEnter</Status>
              </Result>
            </TeamMemberResult>
          </TeamResult>
        </ClassResult>
      </ResultList>
    `);

    expect(parsed.teams).toHaveLength(1);
    expect(parsed.teams[0].teamName).toBe("Фінішували");
    expect(parsed.teams[0].members).toEqual(["Учасник Перший"]);
  });

  it("marks relay teams as incomplete when at least one member did not finish", () => {
    const parsed = parseRogainingIof(`
      <ResultList>
        <ClassResult>
          <Class>
            <Name>Естафета</Name>
          </Class>
          <TeamResult>
            <Name>ВІТВ - 2</Name>
            <TeamMemberResult>
              <Person>
                <Name>
                  <Family>Перший</Family>
                  <Given>Учасник</Given>
                </Name>
              </Person>
              <Result>
                <Time>2919</Time>
                <Status>OK</Status>
                <OverallResult>
                  <Time>2919</Time>
                  <Status>OK</Status>
                </OverallResult>
              </Result>
            </TeamMemberResult>
            <TeamMemberResult>
              <Person>
                <Name>
                  <Family>Другий</Family>
                  <Given>Учасник</Given>
                </Name>
              </Person>
              <Result>
                <Status>Inactive</Status>
                <OverallResult>
                  <Status>Inactive</Status>
                </OverallResult>
              </Result>
            </TeamMemberResult>
          </TeamResult>
        </ClassResult>
      </ResultList>
    `);

    expect(parsed.teams[0].allMembersFinished).toBe(false);
    expect(parsed.teams[0].status).toBe("DidNotFinish");
    expect(parsed.teams[0].memberTimeSecs).toEqual([2919, undefined]);
  });

  it("treats active relay members as an incomplete team, not as a problem status", () => {
    const parsed = parseRogainingIof(`
      <ResultList>
        <ClassResult>
          <Class>
            <Name>Ч ЗСУ</Name>
          </Class>
          <TeamResult>
            <Name>СВ - 1</Name>
            <Organisation>
              <Name>СВ</Name>
            </Organisation>
            <TeamMemberResult>
              <Person>
                <Name>
                  <Family>Тарас</Family>
                  <Given>Мельник</Given>
                </Name>
              </Person>
              <Result>
                <Leg>1</Leg>
                <Time>873</Time>
                <Status>OK</Status>
                <OverallResult>
                  <Time>873</Time>
                  <Status>OK</Status>
                </OverallResult>
              </Result>
            </TeamMemberResult>
            <TeamMemberResult>
              <Person>
                <Name>
                  <Family>Дмитро</Family>
                  <Given>Курочкін</Given>
                </Name>
              </Person>
              <Result>
                <Leg>2</Leg>
                <Status>Active</Status>
                <OverallResult>
                  <Status>Active</Status>
                </OverallResult>
              </Result>
            </TeamMemberResult>
            <TeamMemberResult>
              <Person>
                <Name>
                  <Family>Максим</Family>
                  <Given>Бабич</Given>
                </Name>
              </Person>
              <Result>
                <Leg>3</Leg>
                <Status>Inactive</Status>
                <OverallResult>
                  <Status>Inactive</Status>
                </OverallResult>
              </Result>
            </TeamMemberResult>
          </TeamResult>
        </ClassResult>
      </ResultList>
    `);

    expect(parsed.teams[0].status).toBe("DidNotFinish");
    expect(parsed.teams[0].memberStatuses).toEqual(["OK", "Active", "Inactive"]);
    expect(parsed.teams[0].memberTimeSecs).toEqual([873, undefined, undefined]);
  });

  it("keeps relay team problem status from a member result", () => {
    const parsed = parseRogainingIof(`
      <ResultList>
        <ClassResult>
          <Class>
            <Name>Ч ВВНЗ</Name>
          </Class>
          <TeamResult>
            <Name>ІВМС - 2</Name>
            <Organisation>
              <Name>ІВМС</Name>
            </Organisation>
            <TeamMemberResult>
              <Person>
                <Name>
                  <Family>Перший</Family>
                  <Given>Учасник</Given>
                </Name>
              </Person>
              <Result>
                <Time>2697</Time>
                <Status>OK</Status>
                <OverallResult>
                  <Time>2697</Time>
                  <Status>OK</Status>
                </OverallResult>
              </Result>
            </TeamMemberResult>
            <TeamMemberResult>
              <Person>
                <Name>
                  <Family>Другий</Family>
                  <Given>Учасник</Given>
                </Name>
              </Person>
              <Result>
                <Time>2869</Time>
                <Status>OK</Status>
                <OverallResult>
                  <Time>5566</Time>
                  <Status>OK</Status>
                </OverallResult>
              </Result>
            </TeamMemberResult>
            <TeamMemberResult>
              <Person>
                <Name>
                  <Family>Третій</Family>
                  <Given>Учасник</Given>
                </Name>
              </Person>
              <Result>
                <Time>3014</Time>
                <Status>MissingPunch</Status>
                <OverallResult>
                  <Status>MissingPunch</Status>
                </OverallResult>
              </Result>
            </TeamMemberResult>
          </TeamResult>
        </ClassResult>
      </ResultList>
    `);

    expect(parsed.teams[0].status).toBe("MissingPunch");
    expect(parsed.teams[0].allMembersFinished).toBe(false);
    expect(parsed.teams[0].memberTimeSecs).toEqual([2697, 2869, 3014]);
    expect(parsed.teams[0].memberStatuses).toEqual(["OK", "OK", "MissingPunch"]);
  });
});
