import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { loadConfig, setConfigPath } from "../config";
import { generateReportHtml, generateReportsHtml } from "../core/generate-report-html";
import { normalizeDiplomasConfig } from "../diplomas-config";
import { buildDiplomasHtml, teamDiplomaEntries } from "./diplomas-report";

const dirs: string[] = [];
afterEach(() => {
  setConfigPath(undefined);
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

function config(input: object = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "diplomas-"));
  dirs.push(dir);
  const file = path.join(dir, "config.json");
  fs.writeFileSync(file, JSON.stringify(input));
  setConfigPath(file);
  return loadConfig();
}

const fixture = (name: string) => fs.readFileSync(path.resolve(__dirname, `../__fixtures__/${name}.xml`), "utf8");
const person = (name: string, place: number, time: number, status = "OK", score = 0) => `
  <PersonResult><Person><Name><Given></Given><Family>${name}</Family></Name></Person>
  <Organisation><Name>Школа</Name></Organisation><Result>
  <Position>${place}</Position><Time>${time}</Time><Status>${status}</Status>
  <Score type="Score">${score}</Score></Result></PersonResult>`;
const xml = (people: string) => `<ResultList><Event><StartTime><Date>2026-10-24</Date></StartTime></Event>
  <ClassResult><Class><Name>Ч5-6</Name></Class>${people}</ClassResult></ResultList>`;

describe("universal diplomas", () => {
  it("defaults to the bundled Shantell Sans font and hides the team name", () => {
    config();
    const report = generateReportHtml(xml(person("Призер", 1, 300)), "individual", { diplomas: true });
    expect(report.pdfHtml).toContain("font-family: Shantell Sans, sans-serif");
    expect(report.pdfHtml).toContain("data:font/ttf;base64,");
    expect(report.pdfHtml).not.toContain('class="field teamName"');
    expect(report.pdfHtml).not.toContain("Школа");
    expect(report.pdfHtml).toMatch(/class="field participantName">\s*Призер\s*<\/div>/);
  });

  it("uses protocol places, includes shared third places, and skips live results", () => {
    config();
    const input = xml(person("Перший", 1, 300) + person("Другий", 2, 310)
      + person("ТретійА", 3, 320) + person("ТретійБ", 3, 320)
      + person("Четвертий", 4, 330) + person("НаДистанції", 1, 100, "Active")
      + person("Знятий", 2, 200, "Disqualified"));
    const report = generateReportHtml(input, "individual", { diplomas: true });
    expect(report.itemCount).toBe(4);
    expect(report.pdfHtml).toContain("ТретійБ");
    expect(report.pdfHtml).not.toContain("Четвертий");
    expect(report.pdfHtml).not.toContain("НаДистанції");
    expect(report.pdfHtml).not.toContain("Знятий");
    expect(report.pdfHtml).not.toContain("Diploma template");
    expect(report.viewHtml).toBe(report.pdfHtml);
    expect(generateReportsHtml(input, "all", { diplomas: true })[0].pdfHtml).toBe(report.pdfHtml);
  });

  it("uses the choice protocol ranking instead of XML positions", () => {
    config();
    const input = xml(person("Повільний", 1, 600) + person("Швидкий", 4, 300)
      + person("Середній", 2, 400) + person("Четвертий", 3, 700)
      + person("Знятий", 1, 100, "Disqualified"));
    const report = generateReportHtml(input, "side-by-side-rogaining", { diplomas: true });
    expect(report.itemCount).toBe(3);
    expect(report.pdfHtml).toContain("Швидкий");
    expect(report.pdfHtml).not.toContain("Четвертий");
    expect(report.pdfHtml).not.toContain("Знятий");
  });

  it("uses individual rogaining scores and carries the organisation", () => {
    config({ diplomas: { fields: { teamName: { enabled: true } } } });
    const input = xml(person("Найкращий", 4, 500, "OK", 100)
      + person("Другий", 3, 400, "OK", 90) + person("Третій", 2, 300, "OK", 80)
      + person("Четвертий", 1, 200, "OK", 70));
    const report = generateReportHtml(input, "individual-rogaining", { diplomas: true });
    expect(report.itemCount).toBe(3);
    expect(report.pdfHtml).toContain("Найкращий");
    expect(report.pdfHtml).toContain("Школа");
    expect(report.pdfHtml).not.toContain("Четвертий");
  });

  it("sets independent coordinates for every field and can enable the team name", () => {
    config({ diplomas: {
      page: { width: 297, height: 210 },
      fontFamily: "Arial",
      fields: {
        participantName: { x: 24, y: 70, fontSize: 24 },
        teamName: { enabled: true, x: 50, y: 90 },
        place: { x: 40, y: 110 },
        className: { x: 150, y: 120 },
      },
    } });
    const report = generateReportHtml(xml(person("Призер", 1, 300)), "individual", { diplomas: true });
    expect(report.pdfHtml).toContain("size: 297mm 210mm");
    expect(report.pdfHtml).toContain("left: 24mm; top: 70mm; width: 178mm; height: 9mm;");
    expect(report.pdfHtml).toContain("font-size: 24pt");
    expect(report.pdfHtml).toContain("left: 50mm; top: 90mm; width: 144mm; height: 9mm;");
    expect(report.pdfHtml).toContain("left: 40mm; top: 110mm; width: 25mm; height: 8mm;");
    expect(report.pdfHtml).toContain("left: 150mm; top: 120mm; width: 48mm; height: 8mm;");
    expect(report.pdfHtml).toContain('class="field teamName">Школа</div>');
    expect(report.pdfHtml).not.toContain("data:font/ttf;base64,");
    expect(report.pdfHtml).toContain('class="field place">1</div>');
  });

  it("creates one diploma per team or per member, preserving punctuation and escaping HTML", () => {
    const settings = config({ diplomas: { fields: { teamName: { enabled: true } } } });
    const classes = [{ name: "Ч", teams: [{ place: 1, teamName: "A & B", members: ["Іван, Петро", "<Марко>"] }] }];
    let entries = teamDiplomaEntries(classes, settings);
    expect(entries).toHaveLength(2);
    const html = buildDiplomasHtml(entries, settings);
    expect(html).toContain("Іван, Петро");
    expect(html).toContain("&lt;Марко&gt;");
    expect(html).toContain("A &amp; B");
    settings.diplomas.teamMode = "team";
    entries = teamDiplomaEntries(classes, settings);
    expect(entries).toEqual([{ participantName: "", teamName: "A & B", className: "Ч", place: 1 }]);
  });

  it.each([
    ["relay", "relay"], ["team", "sample"], ["rogaining", "rogaining-test"],
    ["rogaining-diplomas", "rogaining-test"], ["rogaining-score", "rogaining-test"],
    ["rogaining-results", "rogaining-test"], ["rogaining-results-score", "rogaining-test"],
    ["rogaining-splits", "rogaining-test"], ["summary", "sample"], ["summary-team", "sample"],
  ] as const)("supports %s with its normal companion inputs", (type, name) => {
    config({ individual: { scoring: "side-by-side", teamResults: "side-by-side" } });
    const input = fixture(name);
    const report = generateReportHtml(input, type, {
      diplomas: true,
      bazaXml: "<UOFData />",
      courseDataXml: fixture("courses"),
      summarySeriesXmls: [{ type: "individual", xml: input }],
      summaryTeamSeriesXmls: [{ type: "individual", xml: input }],
    });
    expect(report.itemCount).toBeGreaterThan(0);
    expect(report.pdfHtml).toContain('class="diploma-page"');
    expect(report.pdfHtml).not.toContain("<table");
    const places = [...report.pdfHtml.matchAll(/class="field place">(\d+)<\/div>/g)].map((match) => Number(match[1]));
    expect(places).toHaveLength(report.itemCount);
    expect(places.every((place) => place >= 1 && place <= 3)).toBe(true);
  });

  it("uses identical coordinates for the legacy rogaining command", () => {
    config({ diplomas: { fields: { participantName: { y: 60 } } } });
    expect(generateReportHtml(fixture("rogaining-test"), "rogaining-diplomas").pdfHtml).toContain("top: 60mm");
  });
});

describe("diploma config validation", () => {
  it.each([
    { page: { width: -1 } },
    { fields: { place: { x: "20" } } },
    { fields: { place: { width: 0 } } },
    { fields: { place: { y: 290 } } },
    { fields: { typo: {} } },
    { fields: { place: { enabled: "false" } } },
    { teamMode: "unknown" },
  ])("rejects invalid coordinates or settings: %j", (input) => {
    expect(() => normalizeDiplomasConfig(input)).toThrow();
  });
});
