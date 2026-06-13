import { describe, expect, it } from "vitest";
import { buildSummaryTeamHtml } from "./summary-team-report";

describe("buildSummaryTeamHtml", () => {
  it("renders a dynamic column for each selected source", () => {
    const html = buildSummaryTeamHtml(
      [
        {
          type: "individual",
          groups: [{ results: [{ organisation: "Ліцей", points: 120 }] }],
        },
        {
          type: "side-by-side-rogaining",
          groups: [{ results: [{ organisation: "Ліцей", points: 95 }] }],
        },
        {
          type: "relay",
          groups: [{ results: [{ organisation: "Гімназія", points: 200 }] }],
        },
      ],
      new Date(2026, 3, 11),
    );

    expect(html).toContain('<th class="points-cell">Індивідуальна</th>');
    expect(html).toContain('<th class="points-cell">По вибору</th>');
    expect(html).toContain('<th class="points-cell">Естафета</th>');
    expect(html).toContain('<td class="points-cell"><strong>215</strong></td>');
  });

  it("keeps duplicate source types as separate numbered columns", () => {
    const html = buildSummaryTeamHtml(
      [
        {
          type: "individual",
          groups: [{ results: [{ organisation: "Ліцей", points: 100 }] }],
        },
        {
          type: "individual",
          groups: [{ results: [{ organisation: "Ліцей", points: 95 }] }],
        },
      ],
      new Date(2026, 3, 11),
    );

    expect(html).toContain('<th class="points-cell">Індивідуальна 1</th>');
    expect(html).toContain('<th class="points-cell">Індивідуальна 2</th>');
    expect(html).toContain('<td class="points-cell"><strong>195</strong></td>');
  });
});
