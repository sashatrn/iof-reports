import { describe, expect, it } from "vitest";
import { RogainingTeam } from "../io/parse-rogaining-iof";
import { buildRogainingHtml } from "./rogaining-report";

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

describe("buildRogainingHtml", () => {
  it("shows only declared classes and dynamically promotes youth and masters", () => {
    const teams: RogainingTeam[] = [
      {
        className: "Ч18",
        teamName: "Юнаки",
        organisation: "Київ",
        members: ["Юнак 1", "Юнак 2"],
        memberCount: 2,
        score: 20,
        penalty: 0,
        totalScore: 20,
        timeSec: 14000,
        status: "OK",
      },
      {
        className: "Ч23",
        teamName: "Молодь",
        organisation: "Львів",
        members: ["Молодь 1", "Молодь 2"],
        memberCount: 2,
        score: 18,
        penalty: 0,
        totalScore: 18,
        timeSec: 14100,
        status: "OK",
      },
      {
        className: "Ч55",
        teamName: "Майстри",
        organisation: "Одеса",
        members: ["Майстер 1", "Майстер 2"],
        memberCount: 2,
        score: 16,
        penalty: 1,
        totalScore: 15,
        timeSec: 15000,
        status: "OK",
      },
      {
        className: "Ч45",
        teamName: "Старші",
        organisation: "Харків",
        members: ["Старший 1", "Старший 2"],
        memberCount: 2,
        score: 14,
        penalty: 0,
        totalScore: 14,
        timeSec: 15500,
        status: "OK",
      },
      {
        className: "Ч",
        teamName: "Open Team",
        organisation: "Дніпро",
        members: ["Open 1", "Open 2"],
        memberCount: 2,
        score: 25,
        penalty: 0,
        totalScore: 25,
        timeSec: 13000,
        status: "OK",
      },
    ];

    const html = buildRogainingHtml(teams, new Date(2026, 3, 11), "Рогейн");

    expect(html).toContain("<h3>Ч18</h3>");
    expect(html).toContain("<h3>Ч23</h3>");
    expect(html).toContain("<h3>Ч45</h3>");
    expect(html).toContain("<h3>Ч55</h3>");
    expect(html).toContain("<h3>Ч</h3>");
    expect(html).toContain("<h3>OPEN</h3>");
    expect(html).not.toContain("<h3>Ч65</h3>");

    const openSection = getClassSection(html, "Ч");
    expect(openSection).toContain("Юнаки");
    expect(openSection).toContain("Майстри");
    expect(openSection).toContain("Open Team");

    const class45Section = getClassSection(html, "Ч45");
    expect(class45Section).toContain("Майстри");
    expect(class45Section).toContain("Старші");
    expect(class45Section).not.toContain("Open Team");

    const class23Section = getClassSection(html, "Ч23");
    expect(class23Section).toContain("Юнаки");
    expect(class23Section).toContain("Молодь");
    expect(class23Section).not.toContain("Open Team");

    const aggregateOpenSection = getClassSection(html, "OPEN");
    expect(aggregateOpenSection).toContain("Юнаки");
    expect(aggregateOpenSection).toContain("Молодь");
    expect(aggregateOpenSection).toContain("Майстри");
    expect(aggregateOpenSection).toContain("Open Team");
  });

  it("ranks teams by total score, then by time, and leaves non-OK teams unplaced", () => {
    const teams: RogainingTeam[] = [
      {
        className: "Ч",
        teamName: "Повільніші",
        organisation: "Київ",
        members: ["A", "B"],
        memberCount: 2,
        score: 20,
        penalty: 0,
        totalScore: 20,
        timeSec: 12000,
        status: "OK",
      },
      {
        className: "Ч",
        teamName: "Швидші",
        organisation: "Львів",
        members: ["C", "D"],
        memberCount: 2,
        score: 20,
        penalty: 0,
        totalScore: 20,
        timeSec: 11000,
        status: "OK",
      },
      {
        className: "Ч",
        teamName: "Не фінішували",
        organisation: "Одеса",
        members: ["E", "F"],
        memberCount: 2,
        score: 30,
        penalty: 0,
        totalScore: 30,
        timeSec: undefined,
        status: "Active",
      },
    ];

    const html = buildRogainingHtml(teams, new Date(2026, 3, 11), "Рогейн");
    const openSection = getClassSection(html, "Ч");

    expectInOrder(openSection, [
      "<td><strong>1</strong></td>",
      "Швидші",
      "<td><strong>2</strong></td>",
      "Повільніші",
      "Не фінішували",
    ]);
    expect(openSection).toContain("<td></td>");
    expect(openSection).toContain("<td>3:03:20</td>");
  });
});
