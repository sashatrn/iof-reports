import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { loadConfig, setConfigPath } from "../config";
import { generateIndividualReportHtml } from "../core/generate-report-html";
import { type Participant } from "../io/parse-iof";
import { buildGroupedIndividualTeamResults } from "./individual-team-results";
import { buildIndividualSummaryTeamGroups } from "./summary-team-source";

const limits = [
  { classRegex: "^Ч21[АA]$", count: 4 },
  { classRegex: "^Ж21[АA]$", count: 2 },
];
const tempDirs: string[] = [];

afterEach(() => {
  setConfigPath(undefined);
  for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

function participant(className: string, points: number, club = "ЖВІ 1"): Participant {
  return { className, points, club, name: `${className} ${points}`, status: "OK" };
}

describe("military team result limits", () => {
  it("counts the best four men and two women separately for each club", () => {
    const participants = [
      ...[10, 45, 42, 40, 38, 36].map((points) => participant("Ч21А", points)),
      ...[40, 45, 42].map((points) => participant("Ж21А", points)),
      ...[1, 2, 3, 4, 5].map((points) => participant("Ч21A", points, "ЖВІ 2")),
      participant("Ж21A", 6, "ЖВІ 2"),
      participant("Ч21А", 100, "Other club"),
      participant("Ч21Е", 100),
      { ...participant("Ж21А", 100), status: "MissingPunch" },
    ];
    const groups = buildGroupedIndividualTeamResults(
      participants, "ЖВІ", "^[ЧЖ]21[АA]$", [], limits,
    );
    expect(groups).toEqual([{
      name: "Загальний залік",
      teams: [
        { place: 1, organisation: "ЖВІ 1", points: 252 },
        { place: 2, organisation: "ЖВІ 2", points: 20 },
      ],
    }]);
  });

  it("keeps unlimited team scoring when limits are absent", () => {
    const participants = [45, 42, 40, 38, 36].map((points) => participant("Ч21А", points));
    expect(buildGroupedIndividualTeamResults(participants, ".*", ".*", [])[0].teams[0].points)
      .toBe(201);
  });

  it("rejects invalid quotas", () => {
    expect(() => buildGroupedIndividualTeamResults([], ".*", ".*", [], [
      { classRegex: ".*", count: -1 },
    ])).toThrow("teamResultLimits[0].count");
    expect(() => buildGroupedIndividualTeamResults([], ".*", ".*", [], [
      { classRegex: "[", count: 4 },
    ])).toThrow("teamResultLimits[0].classRegex");
  });

  it("filters both report variants and applies military points and quotas in reports and summaries", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "military-report-"));
    tempDirs.push(dir);
    const configPath = path.join(dir, "config.json");
    fs.writeFileSync(configPath, JSON.stringify({
      individual: {
        scoring: "military",
        teamResults: "grouped",
        teamFilterRegex: "ЖВІ",
        classFilterRegex: "^[ЧЖ]21[АA]$",
        filterParticipants: true,
        teamResultLimits: limits,
        classOrderGroups: [],
      },
    }));
    setConfigPath(configPath);
    const entries = [
      { ...participant("Ч21А", 0, "Other club"), name: "Outsider", position: 1 },
      ...Array.from({ length: 6 }, (_, index) => ({
        ...participant("Ч21А", 0), name: `Man ${index + 1}`, position: index + 2,
      })),
      ...Array.from({ length: 3 }, (_, index) => ({
        ...participant("Ж21А", 0), name: `Woman ${index + 1}`, position: index + 1,
      })),
      { ...participant("Ч21Е", 0), name: "Wrong class", position: 1 },
    ];
    const classes = [...new Set(entries.map((entry) => entry.className))];
    const xml = `<ResultList><Event><StartTime><Date>2026-10-24</Date></StartTime></Event>${
      classes.map((className) => `<ClassResult><Class><Name>${className}</Name></Class>${
        entries.filter((entry) => entry.className === className).map((entry) =>
          `<PersonResult><Person><Name><Given></Given><Family>${entry.name}</Family></Name></Person>` +
          `<Organisation><Name>${entry.club}</Name></Organisation><Result><Position>${entry.position}</Position>` +
          `<Time>${600 + entry.position}</Time><Status>OK</Status></Result></PersonResult>`,
        ).join("")
      }</ClassResult>`).join("")
    }</ResultList>`;
    const report = generateIndividualReportHtml(xml);
    for (const html of [report.pdfHtml, report.viewHtml]) {
      expect(html).not.toContain("Outsider");
      expect(html).not.toContain("Wrong class");
      expect(html).not.toContain("Ч21Е");
      expect(html).toContain("Man 6");
      expect(html).toContain("Woman 3");
      expect(/>45<\/td>/.test(html)).toBe(true);
    }
    expect(/<strong>252<\/strong>/.test(report.pdfHtml)).toBe(true);
    const scoredEntries = [
      ...[45, 42, 40, 38, 36, 35].map((points) => participant("Ч21А", points)),
      ...[45, 42, 40].map((points) => participant("Ж21А", points)),
    ];
    expect(buildIndividualSummaryTeamGroups(scoredEntries, loadConfig())[0].results[0].points)
      .toBe(252);
  });
});
