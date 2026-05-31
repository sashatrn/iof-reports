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
  it("renders men and women team tables with ranking positions", () => {
    const html = buildSideBySideTeamHtml(
      {
        men: [
          { club: "Ліцей 1", points: 42 },
          { club: "Ліцей 2", points: 35 },
        ],
        women: [{ club: "Гімназія 3", points: 30 }],
      },
      new Date(2026, 3, 11),
    );

    expect(html).toContain("<h3>Чоловіки</h3>");
    expect(html).toContain("<h3>Жінки</h3>");

    const menSection = getSectionAfterHeader(html, "Чоловіки");
    expectInOrder(menSection, [
      "<td>1</td>",
      "Ліцей 1",
      "<td>42</td>",
      "<td>2</td>",
      "Ліцей 2",
    ]);

    const womenSection = getSectionAfterHeader(html, "Жінки");
    expectInOrder(womenSection, ["<td>1</td>", "Гімназія 3", "<td>30</td>"]);
  });
});
