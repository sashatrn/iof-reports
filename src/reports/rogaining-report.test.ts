import { describe, expect, it } from "vitest";
import { RogainingTeam } from "../io/parse-rogaining-iof";
import {
  buildRogainingAwardsHtml,
  buildRogainingDiplomasHtml,
  buildRogainingHtml,
} from "./rogaining-report";

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

    const html = buildRogainingHtml(teams, new Date(2026, 3, 11), "Рогейн", "view");

    expect(html).toContain("<h3>Ч18</h3>");
    expect(html).toContain("<h3>Ч23</h3>");
    expect(html).toContain("<h3>Ч45</h3>");
    expect(html).toContain("<h3>Ч55</h3>");
    expect(html).toContain("<h3>Ч</h3>");
    expect(html).toContain("<h3>ALL</h3>");
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

    const aggregateOpenSection = getClassSection(html, "ALL");
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

    const html = buildRogainingHtml(teams, new Date(2026, 3, 11), "Рогейн", "view");
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

  it("shows points before penalty and total after penalty", () => {
    const teams: RogainingTeam[] = [
      {
        className: "Ч",
        teamName: "Штрафні",
        organisation: "Київ",
        members: ["A", "B"],
        memberCount: 2,
        score: 16,
        penalty: 3,
        totalScore: 16,
        timeSec: 12000,
        status: "OK",
      },
    ];

    const html = buildRogainingHtml(teams, new Date(2026, 3, 11), "Рогейн", "view");
    const openSection = getClassSection(html, "Ч");

    expect(openSection).toContain("<td>19</td>");
    expect(openSection).toContain("<td><strong>3</strong></td>");
    expect(openSection).toContain("<td><strong>16</strong></td>");
  });

  it("disqualifies OK teams that reach restricted controls before 22", () => {
    const teams: RogainingTeam[] = [
      {
        className: "Ч",
        teamName: "Валідний маршрут",
        organisation: "Київ",
        members: ["A", "B"],
        memberControls: [["21", "22", "70", "45", "100", "70"]],
        memberCount: 2,
        score: 20,
        penalty: 0,
        totalScore: 20,
        timeSec: 12000,
        status: "OK",
      },
      {
        className: "Ч",
        teamName: "До 22",
        organisation: "Львів",
        members: ["C", "D"],
        memberControls: [["21", "70", "22", "100"]],
        memberCount: 2,
        score: 25,
        penalty: 0,
        totalScore: 25,
        timeSec: 11000,
        status: "OK",
      },
      {
        className: "Ч",
        teamName: "Без 22",
        organisation: "Харків",
        members: ["G", "H"],
        memberControls: [["21", "70", "100", "45"]],
        memberCount: 2,
        score: 26,
        penalty: 0,
        totalScore: 26,
        timeSec: 10500,
        status: "OK",
      },
      {
        className: "Ч",
        teamName: "Не були в зоні",
        organisation: "Одеса",
        members: ["E", "F"],
        memberControls: [["21", "45", "66"]],
        memberCount: 2,
        score: 30,
        penalty: 0,
        totalScore: 30,
        timeSec: 10000,
        status: "OK",
      },
    ];

    const html = buildRogainingHtml(teams, new Date(2026, 3, 11), "Рогейн", "view");
    const openSection = getClassSection(html, "Ч");

    expect(openSection).toContain("<th>КП 22</th>");
    expect(openSection).toContain("Валідний маршрут");
    expect(openSection).toContain("<td>OK</td>");
    expect(openSection).toContain("Не були в зоні");
    expect(openSection).toContain("<td>-</td>");
    expect(openSection).toContain("До 22");
    expect(openSection).toContain("Без 22");
    expect(openSection).toContain("<td>DSQ</td>");
    expect(openSection).toContain("<td>disqualified</td>");
  });
});

describe("buildRogainingAwardsHtml", () => {
  it("keeps only top three teams and sorts classes by youth, veterans, main, open with gender order", () => {
    const teams: RogainingTeam[] = [
      {
        className: "Ч18",
        teamName: "Ч18",
        organisation: "A",
        members: ["A1", "A2"],
        memberCount: 2,
        score: 30,
        penalty: 0,
        totalScore: 30,
        timeSec: 10000,
        status: "OK",
      },
      {
        className: "Мікс18",
        teamName: "Мікс18",
        organisation: "B",
        members: ["B1", "B2"],
        memberCount: 2,
        score: 29,
        penalty: 0,
        totalScore: 29,
        timeSec: 10100,
        status: "OK",
      },
      {
        className: "Ж18",
        teamName: "Ж18",
        organisation: "C",
        members: ["C1", "C2"],
        memberCount: 2,
        score: 28,
        penalty: 0,
        totalScore: 28,
        timeSec: 10200,
        status: "OK",
      },
      {
        className: "Ч55",
        teamName: "Ч55",
        organisation: "D",
        members: ["D1", "D2"],
        memberCount: 2,
        score: 27,
        penalty: 0,
        totalScore: 27,
        timeSec: 10300,
        status: "OK",
      },
      {
        className: "Мікси-старі",
        teamName: "Мікси-старі",
        organisation: "E",
        members: ["E1", "E2"],
        memberCount: 2,
        score: 26,
        penalty: 0,
        totalScore: 26,
        timeSec: 10400,
        status: "OK",
      },
      {
        className: "Ж45",
        teamName: "Ж45",
        organisation: "F",
        members: ["F1", "F2"],
        memberCount: 2,
        score: 25,
        penalty: 0,
        totalScore: 25,
        timeSec: 10500,
        status: "OK",
      },
      {
        className: "Ж",
        teamName: "Ж Open",
        organisation: "G",
        members: ["G1", "G2"],
        memberCount: 2,
        score: 24,
        penalty: 0,
        totalScore: 24,
        timeSec: 10600,
        status: "OK",
      },
      {
        className: "Мікси",
        teamName: "Мікси",
        organisation: "H",
        members: ["H1", "H2"],
        memberCount: 2,
        score: 23,
        penalty: 0,
        totalScore: 23,
        timeSec: 10700,
        status: "OK",
      },
      {
        className: "Ч",
        teamName: "Ч Open",
        organisation: "I",
        members: ["I1", "I2"],
        memberCount: 2,
        score: 22,
        penalty: 0,
        totalScore: 22,
        timeSec: 10800,
        status: "OK",
      },
      {
        className: "Ч",
        teamName: "1",
        organisation: "J",
        members: ["J1", "J2"],
        memberCount: 2,
        score: 40,
        penalty: 0,
        totalScore: 40,
        timeSec: 9000,
        status: "OK",
      },
      {
        className: "Ч",
        teamName: "2",
        organisation: "K",
        members: ["K1", "K2"],
        memberCount: 2,
        score: 39,
        penalty: 0,
        totalScore: 39,
        timeSec: 9100,
        status: "OK",
      },
      {
        className: "Ч",
        teamName: "3",
        organisation: "L",
        members: ["L1", "L2"],
        memberCount: 2,
        score: 38,
        penalty: 0,
        totalScore: 38,
        timeSec: 9200,
        status: "OK",
      },
      {
        className: "Ч",
        teamName: "4",
        organisation: "M",
        members: ["M1", "M2"],
        memberCount: 2,
        score: 37,
        penalty: 0,
        totalScore: 37,
        timeSec: 9300,
        status: "OK",
      },
    ];

    const html = buildRogainingAwardsHtml(teams, new Date(2026, 3, 11), "Рогейн", "view");

    expectInOrder(html, [
      "<h3>Ч55</h3>",
      "<h3>Ж45</h3>",
      "<h3>Мікси-старі</h3>",
      "<h3>Ж18</h3>",
      "<h3>Мікс18</h3>",
      "<h3>Ч18</h3>",
      "<h3>Ж</h3>",
      "<h3>Мікси</h3>",
      "<h3>Ч</h3>",
      "<h3>ALL</h3>",
    ]);

    const menOpenSection = getClassSection(html, "Ч");
    expect(menOpenSection).toContain(">1<");
    expect(menOpenSection).toContain(">2<");
    expect(menOpenSection).toContain(">3<");
    expect(menOpenSection).not.toContain(">4<");
  });

  it("applies control gate disqualification to awards without adding a gate column", () => {
    const teams: RogainingTeam[] = [
      {
        className: "Ч",
        teamName: "Коректний вхід",
        organisation: "A",
        members: ["A1", "A2"],
        memberControls: [["21", "22", "70", "45", "100"]],
        memberCount: 2,
        score: 30,
        penalty: 0,
        totalScore: 30,
        timeSec: 10000,
        status: "OK",
      },
      {
        className: "Ч",
        teamName: "Порушник",
        organisation: "B",
        members: ["B1", "B2"],
        memberControls: [["21", "70", "45"]],
        memberCount: 2,
        score: 40,
        penalty: 0,
        totalScore: 40,
        timeSec: 9000,
        status: "OK",
      },
    ];

    const html = buildRogainingAwardsHtml(teams, new Date(2026, 3, 11), "Рогейн", "pdf");

    expect(html).toContain("Коректний вхід");
    expect(html).not.toContain("Порушник");
    expect(html).not.toContain("КП 22");
  });
});

describe("buildRogainingDiplomasHtml", () => {
  it("applies control gate disqualification to diplomas", () => {
    const teams: RogainingTeam[] = [
      {
        className: "Ч",
        teamName: "Фінішери",
        organisation: "A",
        members: ["A1", "A2"],
        memberControls: [["21", "22", "70", "45", "100"]],
        memberCount: 2,
        score: 30,
        penalty: 0,
        totalScore: 30,
        timeSec: 10000,
        status: "OK",
      },
      {
        className: "Ч",
        teamName: "DSQ команда",
        organisation: "B",
        members: ["B1", "B2"],
        memberControls: [["21", "70", "45"]],
        memberCount: 2,
        score: 40,
        penalty: 0,
        totalScore: 40,
        timeSec: 9000,
        status: "OK",
      },
    ];

    const html = buildRogainingDiplomasHtml(teams, new Date(2026, 3, 11), "Рогейн");

    expect(html).toContain("Фінішери");
    expect(html).toContain("A1");
    expect(html).not.toContain("DSQ команда");
    expect(html).not.toContain("B1");
  });
});
