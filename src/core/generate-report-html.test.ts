import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import {
  generateIndividualReportHtml,
  generateReportHtml,
  generateReportsHtml,
  generateRogainingAwardsReportHtml,
  generateRogainingDiplomasReportHtml,
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
    expect(report.viewHtml).toContain("Індивідуальний протокол");
    expect(report.viewHtml).toContain("Ч 5-6");
    expect(report.pdfHtml).toContain("Індивідуальний протокол");
    expect(report.viewHtml).toContain('class="page"');
    expect(report.pdfHtml).toContain("@page");
  });
});

describe("generateTeamReportHtml", () => {
  it("builds team report html from IOF XML", () => {
    const report = generateTeamReportHtml(sampleXml);

    expect(report.reportType).toBe("team");
    expect(report.itemCount).toBeGreaterThan(0);
    expect(report.viewHtml).toContain("Командний протокол");
    expect(report.viewHtml).toContain("Чоловіки");
    expect(report.pdfHtml).toContain("Командний протокол");
    expect(report.viewHtml).toContain('class="page"');
    expect(report.pdfHtml).toContain("@page");
  });
});

describe("generateRogainingReportHtml", () => {
  it("builds rogaining report html from TeamResult IOF XML", () => {
    const report = generateRogainingReportHtml(rogainingXml);

    expect(report.reportType).toBe("rogaining");
    expect(report.itemCount).toBeGreaterThan(0);
    expect(report.viewHtml).toContain("Протокол результатів рогейну");
    expect(report.viewHtml).toContain("Діди");
    expect(report.viewHtml).toContain(">ALL</h3>");
    expect(report.pdfHtml).toContain("Протокол результатів рогейну");
    expect(report.pdfHtml).not.toContain(">ALL</h3>");
    expect(report.viewHtml).toContain('class="page"');
    expect(report.pdfHtml).toContain("@page");
  });
});

describe("generateRogainingAwardsReportHtml", () => {
  it("builds rogaining awards html from TeamResult IOF XML", () => {
    const report = generateRogainingAwardsReportHtml(rogainingXml);

    expect(report.reportType).toBe("rogaining-awards");
    expect(report.itemCount).toBeGreaterThan(0);
    expect(report.viewHtml).toContain("Нагородний протокол рогейну");
    expect(report.viewHtml).toContain(">ALL</h3>");
    expect(report.pdfHtml).toContain("Нагородний протокол рогейну");
    expect(report.pdfHtml).toContain(">ALL</h3>");
  });
});

describe("generateRogainingDiplomasReportHtml", () => {
  it("builds rogaining diplomas html from TeamResult IOF XML", () => {
    const report = generateRogainingDiplomasReportHtml(rogainingXml);

    expect(report.reportType).toBe("rogaining-diplomas");
    expect(report.itemCount).toBeGreaterThan(0);
    expect(report.viewHtml).toContain("diploma-page");
    expect(report.pdfHtml).toContain("@page");
    expect(report.pdfHtml).not.toContain(">ALL<");
    expect(report.pdfHtml).toContain("participant-line");
    expect(report.pdfHtml).not.toContain("Diploma template");
  });

  it("can include diploma background when requested", () => {
    const report = generateRogainingDiplomasReportHtml(rogainingXml, {
      includeDiplomaBackground: true,
    });

    expect(report.pdfHtml).toContain("Diploma template");
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
    expect(report.viewHtml).toContain("Індивідуальний протокол");
    expect(report.pdfHtml).toContain("Індивідуальний протокол");
  });

  it("dispatches to rogaining awards report generator", () => {
    const report = generateReportHtml(rogainingXml, "rogaining-awards");

    expect(report.reportType).toBe("rogaining-awards");
    expect(report.viewHtml).toContain("Нагородний протокол рогейну");
  });

  it("dispatches to rogaining diplomas report generator", () => {
    const report = generateReportHtml(rogainingXml, "rogaining-diplomas");

    expect(report.reportType).toBe("rogaining-diplomas");
    expect(report.pdfHtml).toContain("participant-line");
  });
});
