import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { setConfigPath } from "../config";
import { imageToBase64 } from "../utils/image";
import {
  generateMilitaryIndividualReportHtml,
  generateMilitaryRelayReportHtml,
  generateMilitaryTeamReportHtml,
  generateReportHtml,
  generateReportsHtml,
  generateRogainingAwardsReportHtml,
  generateRogainingDiplomasReportHtml,
  generateRogainingReportHtml,
  generateRogainingResultsReportHtml,
  generateRogainingResultsScoreReportHtml,
  generateRogainingScoreReportHtml,
  generateRogainingSplitsReportHtml,
  generateSideBySideIndividualReportHtml,
  generateSideBySideRelayReportHtml,
  generateSideBySideRogainingReportHtml,
  generateSideBySideTeamReportHtml,
} from "./generate-report-html";

const tempConfigDirs: string[] = [];

afterEach(() => {
  setConfigPath(undefined);
  for (const tempDir of tempConfigDirs.splice(0)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

const sampleXml = fs.readFileSync(
  path.resolve(__dirname, "../__fixtures__/sample.xml"),
  "utf-8",
);
const rogainingXml = fs.readFileSync(
  path.resolve(__dirname, "../__fixtures__/rogaining-test.xml"),
  "utf-8",
);
const sideBySideRogainingXml = fs.readFileSync(
  path.resolve(__dirname, "../__fixtures__/side-by-side-rogaining.xml"),
  "utf-8",
);
const coursesXml = fs.readFileSync(
  path.resolve(__dirname, "../__fixtures__/courses.xml"),
  "utf-8",
);
const militaryLongXml = fs.readFileSync(
  path.resolve(__dirname, "../__fixtures__/military-long.xml"),
  "utf-8",
);
const militaryRelayXml = fs.readFileSync(
  path.resolve(__dirname, "../__fixtures__/relay.xml"),
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
const emptyIndividualXml = `<?xml version="1.0" encoding="utf-8"?>
<ResultList>
  <Event>
    <StartTime>
      <Date>2026-05-21</Date>
    </StartTime>
  </Event>
  <ClassResult>
    <Class>
      <Name>Ж</Name>
    </Class>
  </ClassResult>
</ResultList>`;
const emptyRelayXml = `<?xml version="1.0" encoding="utf-8"?>
<ResultList>
  <Event>
    <Name>Естафета</Name>
    <StartTime>
      <Date>2026-05-22</Date>
    </StartTime>
  </Event>
  <ClassResult>
    <Class>
      <Name>Ж</Name>
    </Class>
  </ClassResult>
</ResultList>`;

function expectInOrder(text: string, fragments: string[]): void {
  let previousIndex = -1;

  for (const fragment of fragments) {
    const currentIndex = text.indexOf(fragment);
    expect(currentIndex, `Expected fragment "${fragment}" to exist`).toBeGreaterThan(-1);
    expect(
      currentIndex,
      `Expected fragment "${fragment}" to appear after the previous one`,
    ).toBeGreaterThan(previousIndex);
    previousIndex = currentIndex;
  }
}

function expectRowContaining(text: string, rowFragment: string): string {
  const fragmentIndex = text.indexOf(rowFragment);

  expect(fragmentIndex, `Expected row containing "${rowFragment}" to exist`).toBeGreaterThan(-1);

  const rowStart = text.lastIndexOf("<tr", fragmentIndex);
  const rowEnd = text.indexOf("</tr>", fragmentIndex);

  expect(rowStart, `Expected row start before "${rowFragment}"`).toBeGreaterThan(-1);
  expect(rowEnd, `Expected row end after "${rowFragment}"`).toBeGreaterThan(-1);

  return text.slice(rowStart, rowEnd + "</tr>".length);
}

function useOfficialSignatureConfig(): void {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "iof-reports-signature-"));
  const signaturePath = path.join(tempDir, "signature.png");
  const configPath = path.join(tempDir, "config.json");

  tempConfigDirs.push(tempDir);
  fs.copyFileSync(path.resolve(__dirname, "../assets/logo1.png"), signaturePath);
  fs.writeFileSync(
    configPath,
    JSON.stringify({
      officials: {
        chiefJudge: {
          name: "Суддя з підписом",
          signatureFile: "signature.png",
        },
        chiefSecretary: {
          name: "Секретар з підписом",
          signatureFile: "signature.png",
        },
        joury1: {
          name: "Суддя журі з підписом",
          signatureFile: "signature.png",
        },
        joury2: {
          name: "Член журі з підписом",
          signatureFile: "signature.png",
        },
        departmentHead: {
          name: "Керівник з підписом",
          signatureFile: "signature.png",
        },
        sportResponsible: {
          name: "Відповідальний з підписом",
          signatureFile: "signature.png",
        },
      },
    }),
  );
  setConfigPath(configPath);
}

function useConfiguredLogoConfig(): { leftLogo: string; rightLogo: string } {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "iof-reports-logos-"));
  const leftLogoPath = path.join(tempDir, "left-logo.png");
  const rightLogoPath = path.join(tempDir, "right-logo.png");
  const configPath = path.join(tempDir, "config.json");

  tempConfigDirs.push(tempDir);
  fs.copyFileSync(path.resolve(__dirname, "../assets/logo2.png"), leftLogoPath);
  fs.copyFileSync(path.resolve(__dirname, "../assets/zhvi-logo.png"), rightLogoPath);
  fs.writeFileSync(
    configPath,
    JSON.stringify({
      leftLogo: "left-logo.png",
      rightLogo: "right-logo.png",
    }),
  );
  setConfigPath(configPath);

  return {
    leftLogo: imageToBase64(leftLogoPath),
    rightLogo: imageToBase64(rightLogoPath),
  };
}

function expectOfficialSignatureImage(pdfHtml: string): void {
  expect(pdfHtml).toContain('class="official-signature-image"');
  expect(pdfHtml).toContain("data:image/png;base64,");
  expect(pdfHtml).toContain("Суддя з підписом");
}

function countOfficialSignatureImages(pdfHtml: string): number {
  return pdfHtml.match(/class="official-signature-image"/g)?.length ?? 0;
}

describe("generateSideBySideIndividualReportHtml", () => {
  it("builds individual report html from IOF XML", () => {
    const report = generateSideBySideIndividualReportHtml(sampleXml);

    expect(report.reportType).toBe("side-by-side-individual");
    expect(report.itemCount).toBeGreaterThan(0);
    expect(report.viewHtml).toContain("Заданий напрямок");
    expect(report.viewHtml).toContain("Ч 5-6");
    expect(report.pdfHtml).toContain("Заданий напрямок");
    expect(report.viewHtml).not.toContain("Командні результати");
    expect(report.pdfHtml).toContain("Командні результати");
    expect(report.pdfHtml).toContain("<h4>Чоловіки</h4>");
    expect(report.pdfHtml).toContain("<h4>Жінки</h4>");
    expect(report.viewHtml).toContain('class="page"');
    expect(report.pdfHtml).toContain("@page");
  });

  it("builds an empty individual report when there are no participants yet", () => {
    const report = generateSideBySideIndividualReportHtml(emptyIndividualXml);

    expect(report.reportType).toBe("side-by-side-individual");
    expect(report.itemCount).toBe(0);
    expect(report.viewHtml).toContain("Заданий напрямок");
    expect(report.pdfHtml).toContain("Заданий напрямок");
    expect(report.viewHtml).not.toContain("<tbody>");
  });

  it("embeds configured report logos from paths relative to config.json", () => {
    const logos = useConfiguredLogoConfig();

    const report = generateSideBySideIndividualReportHtml(sampleXml);

    expect(report.pdfHtml).toContain(logos.leftLogo);
    expect(report.pdfHtml).toContain(logos.rightLogo);
  });
});

describe("generateSideBySideTeamReportHtml", () => {
  it("builds team report html from IOF XML", () => {
    const report = generateSideBySideTeamReportHtml(sampleXml);

    expect(report.reportType).toBe("team");
    expect(report.itemCount).toBeGreaterThan(0);
    expect(report.viewHtml).toContain("Командний протокол");
    expect(report.viewHtml).toContain("Чоловіки");
    expect(report.pdfHtml).toContain("Командний протокол");
    expect(report.viewHtml).toContain('class="page"');
    expect(report.pdfHtml).toContain("@page");
  });

  it("embeds configured official signature images in PDF html", () => {
    useOfficialSignatureConfig();

    const report = generateSideBySideTeamReportHtml(sampleXml);

    expectOfficialSignatureImage(report.pdfHtml);
  });
});

describe("generateSideBySideRelayReportHtml", () => {
  it("builds side-by-side relay report html from TeamResult IOF XML", () => {
    const report = generateSideBySideRelayReportHtml(rogainingXml);

    expect(report.reportType).toBe("side-by-side-relay");
    expect(report.itemCount).toBeGreaterThan(0);
    expect(report.viewHtml).toContain("Естафета");
    expect(report.viewHtml).toContain("<th>Учасники</th>");
    expect(report.viewHtml).toContain("<th>Відст.</th>");
    expect(report.viewHtml).not.toContain("Командні результати");
    expect(report.pdfHtml).toContain("Командні результати");
    expect(report.pdfHtml).toContain("@page");
  });

  it("builds an empty side-by-side relay report when there are no teams yet", () => {
    const report = generateSideBySideRelayReportHtml(emptyRelayXml);

    expect(report.reportType).toBe("side-by-side-relay");
    expect(report.itemCount).toBe(0);
    expect(report.eventName).toBe("Естафета");
    expect(report.viewHtml).toContain("Естафета");
    expect(report.pdfHtml).toContain("Естафета");
    expect(report.viewHtml).not.toContain("<tbody>");
  });
});

describe("generateSideBySideRogainingReportHtml", () => {
  it("builds side-by-side rogaining report html from individual IOF XML", () => {
    const report = generateSideBySideRogainingReportHtml(sideBySideRogainingXml);

    expect(report.reportType).toBe("side-by-side-rogaining");
    expect(report.itemCount).toBeGreaterThan(0);
    expect(report.viewHtml).toContain("За вибором");
    expect(report.viewHtml).toContain("<th>Кількість КП</th>");
    expect(report.viewHtml).toContain("<th>Бал</th>");
    expect(report.viewHtml).toContain("Неактивний");
    expect(report.pdfHtml).not.toContain("Неактивний");
    expect(report.viewHtml).not.toContain("Командні результати");
    expect(report.pdfHtml).toContain("Командні результати");
    expect(report.pdfHtml).toContain("@page");
  });
});

describe("generateMilitaryIndividualReportHtml", () => {
  it("builds military individual report html from IOF XML", () => {
    const report = generateMilitaryIndividualReportHtml(sampleXml);

    expect(report.reportType).toBe("military-individual");
    expect(report.itemCount).toBeGreaterThan(0);
    expect(report.viewHtml).toContain("Довга дистанція");
    expect(report.viewHtml).toContain("Ч 5-6");
    expect(report.viewHtml).toContain("<th>Відст.</th>");
    expect(report.viewHtml).toContain("<td>+0:08</td>");
    expect(report.viewHtml).not.toContain("Командні результати");
    expect(report.pdfHtml).toContain("Командні результати");
    expect(report.pdfHtml).toContain("@page");
  });

  it("builds an empty military individual report when there are no participants yet", () => {
    const report = generateMilitaryIndividualReportHtml(emptyIndividualXml);

    expect(report.reportType).toBe("military-individual");
    expect(report.itemCount).toBe(0);
    expect(report.viewHtml).toContain("Довга дистанція");
    expect(report.pdfHtml).toContain("Довга дистанція");
    expect(report.viewHtml).not.toContain("<tbody>");
  });

  it("separates military individual team results by ВВНЗ and ЗСУ groups", () => {
    const report = generateMilitaryIndividualReportHtml(militaryLongXml);

    expect(report.pdfHtml).toContain("Командні результати");
    expect(report.pdfHtml).toContain("<h4>ВВНЗ</h4>");
    expect(report.pdfHtml).toContain("<h4>ЗСУ</h4>");
  });

  it("orders military individual class tables by configured team groups", () => {
    const report = generateMilitaryIndividualReportHtml(militaryLongXml);

    expectInOrder(report.pdfHtml, [
      "<h3>Ж ВВНЗ</h3>",
      "<h3>Ч ВВНЗ</h3>",
      "<h3>Ж ЗСУ</h3>",
      "<h3>Ч ЗСУ</h3>",
      "Командні результати",
    ]);
    expectInOrder(report.viewHtml, [
      "<h3>Ж ВВНЗ</h3>",
      "<h3>Ч ВВНЗ</h3>",
      "<h3>Ж ЗСУ</h3>",
      "<h3>Ч ЗСУ</h3>",
    ]);
  });
});

describe("generateMilitaryRelayReportHtml", () => {
  it("builds military relay report html from TeamResult IOF XML", () => {
    const report = generateMilitaryRelayReportHtml(rogainingXml);

    expect(report.reportType).toBe("military-relay");
    expect(report.itemCount).toBeGreaterThan(0);
    expect(report.viewHtml).toContain("Естафета");
    expect(report.viewHtml).toContain("<th>Учасники</th>");
    expect(report.viewHtml).toContain("<th>Відст.</th>");
    expect(report.viewHtml).not.toContain("Загальнокомандний результат");
    expect(report.pdfHtml).toContain("Загальнокомандний результат");
    expect(report.pdfHtml).toContain("@page");
  });

  it("builds an empty military relay report when there are no teams yet", () => {
    const report = generateMilitaryRelayReportHtml(emptyRelayXml);

    expect(report.reportType).toBe("military-relay");
    expect(report.itemCount).toBe(0);
    expect(report.eventName).toBe("Естафета");
    expect(report.viewHtml).toContain("Естафета");
    expect(report.pdfHtml).toContain("Естафета");
    expect(report.viewHtml).not.toContain("<tbody>");
  });

  it("marks military relay teams with problem statuses in view and pdf", () => {
    const report = generateMilitaryRelayReportHtml(militaryRelayXml);
    const viewRow = expectRowContaining(report.viewHtml, "ЖВІ - 4");
    const pdfRow = expectRowContaining(report.pdfHtml, "ЖВІ - 4");

    expect(viewRow).toContain('data-status="MissingPunch"');
    expect(viewRow).toContain("<td>Не всі КП</td>");
    expect(viewRow).toContain("<td><strong>0</strong></td>");
    expect(viewRow).not.toContain("<td>OK</td>");
    expect(pdfRow).toContain("<td>Не всі КП</td>");
    expect(pdfRow).toContain("<td><strong>0</strong></td>");
    expect(pdfRow).not.toContain("<td>OK</td>");
  });
});

describe("generateMilitaryTeamReportHtml", () => {
  it("builds military team summary html from individual and relay XML files", () => {
    const report = generateMilitaryTeamReportHtml(militaryLongXml, {
      relayXml: militaryRelayXml,
    });

    expect(report.reportType).toBe("military-team");
    expect(report.supportsView).toBe(false);
    expect(report.itemCount).toBeGreaterThan(0);
    expect(report.pdfHtml).toContain("Командний підсумок");
    expect(report.pdfHtml).toContain("<h3>ВВНЗ</h3>");
    expect(report.pdfHtml).toContain("<h3>ЗСУ</h3>");
    expect(report.pdfHtml).toContain("<th>Індивідуальні очки</th>");
    expect(report.pdfHtml).toContain("<th>Естафетні очки</th>");
  });

  it("requires relay/team XML", () => {
    expect(() => generateMilitaryTeamReportHtml(sampleXml)).toThrow(
      "relay/team IOF XML",
    );
  });

  it("builds an empty military team summary when the relay XML has no teams yet", () => {
    const report = generateMilitaryTeamReportHtml(emptyIndividualXml, {
      relayXml: emptyRelayXml,
    });

    expect(report.reportType).toBe("military-team");
    expect(report.itemCount).toBe(0);
    expect(report.pdfHtml).toContain("Командний підсумок");
    expect(report.pdfHtml).not.toContain("<tbody>");
    expect(report.pdfHtml).not.toContain("<td><strong>1</strong></td>");
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

describe("configured PDF signatures", () => {
  it("uses signature images in protocols that render the default PDF footer", () => {
    useOfficialSignatureConfig();

    const reports = [
      generateSideBySideIndividualReportHtml(sampleXml),
      generateSideBySideRelayReportHtml(rogainingXml),
      generateMilitaryIndividualReportHtml(sampleXml),
      generateMilitaryRelayReportHtml(rogainingXml),
      generateMilitaryTeamReportHtml(militaryLongXml, { relayXml: militaryRelayXml }),
      generateRogainingReportHtml(rogainingXml),
      generateRogainingAwardsReportHtml(rogainingXml),
      generateRogainingSplitsReportHtml(rogainingXml, { courseDataXml: coursesXml }),
    ];

    for (const report of reports) {
      expectOfficialSignatureImage(report.pdfHtml);
      expect(countOfficialSignatureImages(report.pdfHtml)).toBe(2);
    }
  });

  it("uses signature images in protocols with custom PDF signature blocks", () => {
    useOfficialSignatureConfig();

    const scoreReport = generateRogainingScoreReportHtml(rogainingXml);
    const resultsReport = generateRogainingResultsReportHtml(rogainingXml, { bazaXml });
    const resultsScoreReport = generateRogainingResultsScoreReportHtml(rogainingXml, {
      bazaXml,
    });

    expectOfficialSignatureImage(scoreReport.pdfHtml);
    expect(countOfficialSignatureImages(scoreReport.pdfHtml)).toBe(3);
    expect(scoreReport.pdfHtml).toContain("Керівник з підписом");
    expect(scoreReport.pdfHtml).toContain("Відповідальний з підписом");

    expectOfficialSignatureImage(resultsReport.pdfHtml);
    expect(countOfficialSignatureImages(resultsReport.pdfHtml)).toBe(4);
    expect(resultsReport.pdfHtml).toContain("Секретар з підписом");
    expect(resultsReport.pdfHtml).toContain("Суддя журі з підписом");
    expect(resultsReport.pdfHtml).toContain("Член журі з підписом");

    expectOfficialSignatureImage(resultsScoreReport.pdfHtml);
    expect(countOfficialSignatureImages(resultsScoreReport.pdfHtml)).toBe(4);
    expect(resultsScoreReport.pdfHtml).toContain("Секретар з підписом");
    expect(resultsScoreReport.pdfHtml).toContain("Суддя журі з підписом");
    expect(resultsScoreReport.pdfHtml).toContain("Член журі з підписом");
  });
});

describe("generateReportsHtml", () => {
  it("builds one combined side-by-side report for all mode", () => {
    const reports = generateReportsHtml(sampleXml, "all");

    expect(reports).toHaveLength(1);
    expect(reports[0].reportType).toBe("side-by-side-individual");
    expect(reports[0].pdfHtml).toContain("Заданий напрямок");
    expect(reports[0].pdfHtml).toContain("Командні результати");
  });
});

describe("generateReportHtml", () => {
  it("dispatches to side-by-side individual report generator", () => {
    const report = generateReportHtml(sampleXml, "side-by-side-individual");

    expect(report.reportType).toBe("side-by-side-individual");
    expect(report.viewHtml).toContain("Заданий напрямок");
    expect(report.pdfHtml).toContain("Заданий напрямок");
  });

  it("dispatches to side-by-side relay report generator", () => {
    const report = generateReportHtml(rogainingXml, "side-by-side-relay");

    expect(report.reportType).toBe("side-by-side-relay");
    expect(report.viewHtml).toContain("Естафета");
  });

  it("dispatches to side-by-side rogaining report generator", () => {
    const report = generateReportHtml(
      sideBySideRogainingXml,
      "side-by-side-rogaining",
    );

    expect(report.reportType).toBe("side-by-side-rogaining");
    expect(report.viewHtml).toContain('Дистанція "За вибором"');
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

  it("dispatches to military reports", () => {
    const individualReport = generateReportHtml(sampleXml, "military-individual");
    const relayReport = generateReportHtml(rogainingXml, "military-relay");
    const teamReport = generateReportHtml(sampleXml, "military-team", {
      relayXml: rogainingXml,
    });

    expect(individualReport.reportType).toBe("military-individual");
    expect(relayReport.reportType).toBe("military-relay");
    expect(teamReport.reportType).toBe("military-team");
  });
});
