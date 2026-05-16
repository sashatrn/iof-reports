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
  generateRogainingResultsReportHtml,
  generateRogainingScoreReportHtml,
  generateRogainingSplitsReportHtml,
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
const coursesXml = fs.readFileSync(
  path.resolve(__dirname, "../__fixtures__/courses.xml"),
  "utf-8",
);
const bazaXml = `<?xml version="1.0" encoding="utf-8"?>
<UOFData>
  <Names>Тестовий рогейн</Names>
  <Sportsman>
    <FIO>Зуєва Владислава</FIO>
    <Birthday>07.12.2008</Birthday>
    <Qualification>б/р</Qualification>
    <Region>Донецька</Region>
    <Trener>Тестовий Т.Т.</Trener>
    <Prim>Вибри</Prim>
  </Sportsman>
  <Sportsman>
    <FIO>Зуєва Ярослава</FIO>
    <Birthday>21.04.2012</Birthday>
    <Qualification>б/р</Qualification>
    <Region>Донецька</Region>
    <Prim>Вибри</Prim>
  </Sportsman>
</UOFData>`;

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
    expect(report.viewHtml).toContain("<th>Команда</th>");
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
    expect(report.docx?.subarray(0, 2).toString()).toBe("PK");
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

describe("generateRogainingScoreReportHtml", () => {
  it("builds rogaining score html from TeamResult IOF XML", () => {
    const report = generateRogainingScoreReportHtml(rogainingXml);

    expect(report.reportType).toBe("rogaining-score");
    expect(report.itemCount).toBeGreaterThan(0);
    expect(report.viewHtml).toContain("<h1 class=\"score-doc-title\">Звіт</h1>");
    expect(report.viewHtml).toContain("<th>очки рейтин-гу</th>");
    expect(report.pdfHtml).toContain("<h1 class=\"score-doc-title\">Звіт</h1>");
  });
});

describe("generateRogainingResultsReportHtml", () => {
  it("builds rogaining results html with UOF baza data", () => {
    const report = generateRogainingResultsReportHtml(rogainingXml, {
      bazaXml,
    });

    expect(report.reportType).toBe("rogaining-results");
    expect(report.itemCount).toBeGreaterThan(0);
    expect(report.viewHtml).toContain("ПРОТОКОЛ РЕЗУЛЬТАТІВ ЗМАГАНЬ З ОРІЄНТУВАННЯ");
    expect(report.viewHtml).toContain("Зуєва Владислава");
    expect(report.viewHtml).toContain("Ранг дистанції");
    expect(report.viewHtml).toContain("Викон.<br>розряд");
  });

  it("requires UOF baza XML", () => {
    expect(() => generateRogainingResultsReportHtml(rogainingXml)).toThrow(
      "UOF baza XML",
    );
  });
});

describe("generateRogainingSplitsReportHtml", () => {
  it("builds rogaining splits html from TeamResult and CourseData XML", () => {
    const report = generateRogainingSplitsReportHtml(rogainingXml, {
      courseDataXml: coursesXml,
    });

    expect(report.reportType).toBe("rogaining-splits");
    expect(report.itemCount).toBeGreaterThan(0);
    expect(report.viewHtml).toContain("Спліти рогейну");
    expect(report.viewHtml).toContain("<th>Темп хв/км</th>");
    expect(report.viewHtml).toContain("<th>Відстань від початку</th>");
    expect(report.pdfHtml).toContain("Загальна відстань");
  });

  it("requires CourseData XML", () => {
    expect(() => generateRogainingSplitsReportHtml(rogainingXml)).toThrow(
      "CourseData XML",
    );
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

  it("dispatches to rogaining score report generator", () => {
    const report = generateReportHtml(rogainingXml, "rogaining-score");

    expect(report.reportType).toBe("rogaining-score");
    expect(report.viewHtml).toContain("<h1 class=\"score-doc-title\">Звіт</h1>");
  });

  it("dispatches to rogaining results report generator", () => {
    const report = generateReportHtml(rogainingXml, "rogaining-results", {
      bazaXml,
    });

    expect(report.reportType).toBe("rogaining-results");
    expect(report.viewHtml).toContain("Зуєва Владислава");
  });

  it("dispatches to rogaining splits report generator", () => {
    const report = generateReportHtml(rogainingXml, "rogaining-splits", {
      courseDataXml: coursesXml,
    });

    expect(report.reportType).toBe("rogaining-splits");
    expect(report.viewHtml).toContain("Спліти рогейну");
  });
});
