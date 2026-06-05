import { describe, expect, it } from "vitest";
import { buildSideBySideSummaryHtml } from "./side-by-side-summary-report";

describe("buildSideBySideSummaryHtml", () => {
  it("renders a dynamic column for each selected source", () => {
    const html = buildSideBySideSummaryHtml(
      [
        {
          type: "individual",
          results: [{ organisation: "Ліцей", points: 120 }],
        },
        {
          type: "rogaining",
          results: [{ organisation: "Ліцей", points: 95 }],
        },
        {
          type: "relay",
          results: [{ organisation: "Гімназія", points: 200 }],
        },
      ],
      new Date(2026, 3, 11),
    );

    expect(html).toContain('<th class="points-cell">В заданому напрямку</th>');
    expect(html).toContain('<th class="points-cell">По вибору</th>');
    expect(html).toContain('<th class="points-cell">Естафета</th>');
    expect(html).toContain("<td>Ліцей</td>");
    expect(html).toContain('<td class="points-cell"><strong>215</strong></td>');
    expect(html).toContain("<td>Гімназія</td>");
    expect(html).toContain('<td class="points-cell"><strong>200</strong></td>');
  });

  it("keeps duplicate source types as separate numbered columns", () => {
    const html = buildSideBySideSummaryHtml(
      [
        {
          type: "individual",
          results: [{ organisation: "Ліцей", points: 100 }],
        },
        {
          type: "individual",
          results: [{ organisation: "Ліцей", points: 95 }],
        },
      ],
      new Date(2026, 3, 11),
    );

    expect(html).toContain('<th class="points-cell">В заданому напрямку 1</th>');
    expect(html).toContain('<th class="points-cell">В заданому напрямку 2</th>');
    expect(html).toContain('<td class="points-cell"><strong>195</strong></td>');
  });
});
