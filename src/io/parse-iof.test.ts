import { describe, expect, it } from "vitest";
import { parseIof, shouldExcludeResultStatus } from "./parse-iof";

describe("parseIof", () => {
  it("excludes DidNotEnter participants", () => {
    const parsed = parseIof(`
      <ResultList>
        <ClassResult>
          <Class>
            <Name>Ч</Name>
          </Class>
          <PersonResult>
            <Person>
              <Name>
                <Family>Заліковий</Family>
                <Given>Учасник</Given>
              </Name>
            </Person>
            <Organisation>
              <Name>Команда</Name>
            </Organisation>
            <Result>
              <Time>3600</Time>
              <Position>1</Position>
              <Status>OK</Status>
            </Result>
          </PersonResult>
          <PersonResult>
            <Person>
              <Name>
                <Family>Неявка</Family>
                <Given>Учасник</Given>
              </Name>
            </Person>
            <Organisation>
              <Name>Команда</Name>
            </Organisation>
            <Result>
              <Status>DidNotEnter</Status>
            </Result>
          </PersonResult>
        </ClassResult>
      </ResultList>
    `);

    expect(parsed.participants).toHaveLength(1);
    expect(parsed.participants[0].name).toBe("Учасник Заліковий");
  });

  it("checks ignored statuses from the provided list", () => {
    const ignoredStatuses = new Set(["DNS"]);

    expect(shouldExcludeResultStatus("DNS", ignoredStatuses)).toBe(true);
    expect(shouldExcludeResultStatus("DidNotEnter", ignoredStatuses)).toBe(false);
  });

  it("reads result score separately and uses it as the control count fallback", () => {
    const parsed = parseIof(`
      <ResultList>
        <ClassResult>
          <Class>
            <Name>Ж</Name>
          </Class>
          <PersonResult>
            <Person>
              <Name>
                <Family>Score</Family>
                <Given>Runner</Given>
              </Name>
            </Person>
            <Result>
              <Status>OK</Status>
              <Score type="Score">7</Score>
              <Score type="Penalty">3</Score>
              <SplitTime status="Additional">
                <ControlCode>31</ControlCode>
              </SplitTime>
            </Result>
          </PersonResult>
          <PersonResult>
            <Person>
              <Name>
                <Family>Splits</Family>
                <Given>Runner</Given>
              </Name>
            </Person>
            <Result>
              <Status>MissingPunch</Status>
              <SplitTime status="Additional">
                <ControlCode>31</ControlCode>
              </SplitTime>
              <SplitTime status="Missing">
                <ControlCode>32</ControlCode>
              </SplitTime>
              <SplitTime status="Additional">
                <ControlCode>33</ControlCode>
              </SplitTime>
            </Result>
          </PersonResult>
        </ClassResult>
      </ResultList>
    `);

    expect(parsed.participants.map((participant) => participant.controlCount)).toEqual([7, 2]);
    expect(parsed.participants.map((participant) => participant.resultScore)).toEqual([
      7,
      undefined,
    ]);
    expect(parsed.participants.map((participant) => participant.resultPenalty)).toEqual([
      3,
      undefined,
    ]);
  });
});
