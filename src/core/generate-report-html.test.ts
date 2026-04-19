import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import {
  generateIndividualReportHtml,
  generateReportHtml,
  generateReportsHtml,
  generateRogainingReportHtml,
  generateTeamReportHtml,
} from "./generate-report-html";

const sampleXml = fs.readFileSync(
  path.resolve(__dirname, "../__fixtures__/sample.xml"),
  "utf-8",
);
const rogainingXml = fs.readFileSync(
  path.resolve(__dirname, "../__fixtures__/rogaining-test.xml"),
  "utf-8",
);

describe("generateIndividualReportHtml", () => {
  it("builds individual report html from IOF XML", () => {
    const report = generateIndividualReportHtml(sampleXml);

    expect(report.reportType).toBe("individual");
    expect(report.itemCount).toBeGreaterThan(0);
    expect(report.html).toContain("Індивідуальний протокол");
    expect(report.html).toContain("Ч 5-6");
  });
});

describe("generateTeamReportHtml", () => {
  it("builds team report html from IOF XML", () => {
    const report = generateTeamReportHtml(sampleXml);

    expect(report.reportType).toBe("team");
    expect(report.itemCount).toBeGreaterThan(0);
    expect(report.html).toContain("Командний протокол");
    expect(report.html).toContain("Чоловіки");
  });
});

describe("generateRogainingReportHtml", () => {
  it("builds rogaining report html from TeamResult IOF XML", () => {
    const report = generateRogainingReportHtml(rogainingXml);

    expect(report.reportType).toBe("rogaining");
    expect(report.itemCount).toBeGreaterThan(0);
    expect(report.html).toContain("Протокол результатів рогейну");
    expect(report.html).toContain("Діди");
  });
});

describe("generateReportsHtml", () => {
  it("builds two reports for all mode", () => {
    const reports = generateReportsHtml(sampleXml, "all");

    expect(reports).toHaveLength(2);
    expect(reports.map((report) => report.reportType)).toEqual([
      "individual",
      "team",
    ]);
  });
});

describe("generateReportHtml", () => {
  it("dispatches to individual report generator", () => {
    const report = generateReportHtml(sampleXml, "individual");

    expect(report.reportType).toBe("individual");
    expect(report.html).toContain("Індивідуальний протокол");
  });
});
