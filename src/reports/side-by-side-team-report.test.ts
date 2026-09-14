import { describe, expect, it } from "vitest";
import { buildSideBySideTeamHtml } from "./side-by-side-team-report";

function expectInOrder(text: string, fragments: string[]): void {
  let previousIndex = -1;

  for (const fragment of fragments) {
    const currentIndex = text.indexOf(fragment);
    expect(currentIndex, `Expected fragment "${fragment}" to exist`).toBeGreaterThan(
      -1,
    );
    expect(
      currentIndex,
      `Expected fragment "${fragment}" to appear after the previous one`,
    ).toBeGreaterThan(previousIndex);
    previousIndex = currentIndex;
  }
}

function getSectionAfterHeader(html: string, headerText: string): string {
  const header = `<h3>${headerText}</h3>`;
  const start = html.indexOf(header);

  expect(start, `Expected section ${headerText} to exist`).toBeGreaterThan(-1);

  const end = html.indexOf("</table>", start);
  expect(end).toBeGreaterThan(start);

  return html.slice(start, end);
}

describe("buildSideBySideTeamHtml", () => {
  it("renders mixed team tables by event age group", () => {
    const html = buildSideBySideTeamHtml(
      [{
        name: "5-9 класи",
        teams: [
          { place: 1, organisation: "Ліцей 1", points: 42, countedResults: [] },
          { place: 2, organisation: "Ліцей 2", points: 35, countedResults: [] },
        ],
      }, {
        name: "9-12 класи",
        teams: [
          { place: 1, organisation: "Гімназія 3", points: 30, countedResults: [] },
        ],
      }],
      new Date(2026, 3, 11),
    );

    expect(html).toContain("<h3>5-9 класи</h3>");
    expect(html).toContain("<h3>9-12 класи</h3>");

    const menSection = getSectionAfterHeader(html, "5-9 класи");
    expectInOrder(menSection, [
      '<td class="place-cell">1</td>',
      "Ліцей 1",
      '<td class="points-cell">42</td>',
      '<td class="place-cell">2</td>',
      "Ліцей 2",
    ]);

    const womenSection = getSectionAfterHeader(html, "9-12 класи");
    expectInOrder(womenSection, [
      '<td class="place-cell">1</td>',
      "Гімназія 3",
      '<td class="points-cell">30</td>',
    ]);
  });
});
