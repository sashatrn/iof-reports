import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { setConfigPath } from "../config";
import { type Participant } from "../io/parse-iof";
import { buildSummaryHtml } from "./summary-report";

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
