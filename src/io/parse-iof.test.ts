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
});
