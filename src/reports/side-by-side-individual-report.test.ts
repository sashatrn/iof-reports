import { describe, expect, it } from "vitest";
import { Participant } from "../io/parse-iof";
import { buildSideBySideIndividualHtml } from "./side-by-side-individual-report";

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

function getClassSection(html: string, className: string): string {
  const header = `<h3>${className}</h3>`;
  const start = html.indexOf(header);

  expect(start, `Expected class section ${className} to exist`).toBeGreaterThan(-1);

  const end = html.indexOf("</table>", start);
  expect(end).toBeGreaterThan(start);

  return html.slice(start, end);
}

describe("buildSideBySideIndividualHtml", () => {
  it("groups participants by class and sorts them by position", () => {
    const participants: Participant[] = [
      {
        className: "Ч 7-8",
        name: "Runner Without Place",
        club: "Club B",
        timeSec: undefined,
        position: undefined,
        status: "OK",
        points: 4,
      },
      {
        className: "Ч 5-6",
        name: "Second Runner",
        club: "Club A",
        timeSec: 3900,
        position: 2,
        status: "OK",
        points: 7,
      },
      {
        className: "Ч 5-6",
        name: "Active Runner",
        club: "Club A",
        timeSec: undefined,
        position: undefined,
        status: "Active",
        points: 1,
      },
      {
        className: "Ч 5-6",
        name: "First Runner",
        club: "Club A",
        timeSec: 3725,
        position: 1,
        status: "OK",
        points: 10,
      },
    ];

    const html = buildSideBySideIndividualHtml(participants, new Date(2026, 3, 11));

    expectInOrder(html, [
      "<h3>Ч 5-6</h3>",
      "First Runner",
      "1:02:05",
      "Second Runner",
      "1:05:00",
      "<h3>Ч 7-8</h3>",
      "Runner Without Place",
    ]);
    expect(html).not.toContain("Active Runner");

    const classSection = getClassSection(html, "Ч 5-6");
    expectInOrder(classSection, [
      "<td>1</td>",
      "First Runner",
      "<td>2</td>",
      "Second Runner",
    ]);
  });

  it("renders team results in the PDF variant when provided", () => {
    const html = buildSideBySideIndividualHtml(
      [],
      new Date(2026, 3, 11),
      "pdf",
      {
        men: [{ club: "Ліцей 1", points: 120 }],
        women: [{ club: "Гімназія 2", points: 110 }],
      },
    );

    expect(html).toContain("<h3>Командні результати</h3>");
    expect(html).toContain("<h4>Чоловіки</h4>");
    expect(html).toContain("Ліцей 1");
    expect(html).toContain("<h4>Жінки</h4>");
    expect(html).toContain("Гімназія 2");
  });
});
