import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { loadConfig, setConfigPath } from "../config";
import { type Participant } from "../io/parse-iof";
import { buildSummaryHtml, buildSummaryStandingGroupsFromSources } from "./summary-report";

afterEach(() => {
  setConfigPath(undefined);
});

function participant(className: string, name: string, points: number): Participant {
  return {
    className,
    name,
    club: "Команда",
    status: "OK",
    points,
  };
}

function expectInOrder(text: string, fragments: string[]): void {
  let previousIndex = -1;

  for (const fragment of fragments) {
    const currentIndex = text.indexOf(fragment);
    expect(currentIndex, `Expected fragment "${fragment}" to exist`).toBeGreaterThan(-1);
    expect(
      currentIndex,
      `Expected fragment "${fragment}" to appear after the previous one`,
    ).toBeGreaterThan(previousIndex);
    previousIndex = currentIndex;
  }
}

describe("buildSummaryHtml", () => {
  it.each([false, true])("uses configured name matching for diplomas=%s and metadata", (diplomas) => {
    setConfigPath(path.resolve(__dirname, "../__fixtures__/summary-name-match-config.json"));
    expect(loadConfig().summary.matchBy).toBe("name");
    const sources = [
      { type: "individual" as const, participants: [{ ...participant("Ч", "Призер", 900), club: "Клуб" }] },
      { type: "individual" as const, participants: [{ ...participant("Ч", "Призер", 800), club: "Unknown" }] },
    ];
    const groups = buildSummaryStandingGroupsFromSources(sources);
    expect(groups[0].standings).toHaveLength(1);
    expect(groups[0].standings[0].totalPoints).toBe(1700);
    expect(groups[0].standings[0].organisation).toBe("Клуб");
    const html = buildSummaryHtml(sources, new Date(2026, 9, 25), { diplomas });
    expect(html.split("Призер")).toHaveLength(2);
    if (!diplomas) {
      expect(html).toContain("1700");
      expect(html).toContain("<td>Клуб</td>");
    }
  });

  it("uses configured awards class order", () => {
    setConfigPath(path.resolve(__dirname, "../__fixtures__/awards-class-order-config.json"));

    const html = buildSummaryHtml(
      [
        {
          type: "individual",
          participants: [
            participant("Ж", "Ж учасниця", 100),
            participant("Ч", "Ч учасник", 100),
          ],
        },
      ],
      new Date(2026, 3, 11),
      { awardsOnly: true },
    );

    expectInOrder(html, ["<h3>Ч</h3>", "<h3>Ж</h3>"]);
  });
});
