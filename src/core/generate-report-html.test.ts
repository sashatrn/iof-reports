import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { loadConfig, setConfigPath } from "../config";
import { imageToBase64 } from "../utils/image";
import {
  generateIndividualReportHtml,
  generateIndividualRogainingReportHtml,
  generateRelayReportHtml,
  generateReportHtml,
  generateReportsHtml,
  generateRogainingDiplomasReportHtml,
  generateRogainingReportHtml,
  generateRogainingResultsReportHtml,
  generateRogainingResultsScoreReportHtml,
  generateRogainingScoreReportHtml,
  generateRogainingSplitsReportHtml,
  generateSideBySideRogainingReportHtml,
  generateSummaryReportHtml,
  generateSummaryTeamReportHtml,
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

function useIndividualExampleConfig(name: "side-by-side" | "military"): void {
  setConfigPath(path.resolve(__dirname, `../../config-individual-${name}.json`));
}

function expectOfficialSignatureImage(pdfHtml: string): void {
  expect(pdfHtml).toContain('class="official-signature-image"');
  expect(pdfHtml).toContain("data:image/png;base64,");
  expect(pdfHtml).toContain("Суддя з підписом");
}

function countOfficialSignatureImages(pdfHtml: string): number {
  return pdfHtml.match(/class="official-signature-image"/g)?.length ?? 0;
}

describe("generateIndividualReportHtml with regular scoring", () => {
  it("builds individual report html from IOF XML", () => {
    const report = generateIndividualReportHtml(sampleXml);

    expect(report.reportType).toBe("individual");
    expect(report.itemCount).toBeGreaterThan(0);
    expect(report.viewHtml).toContain("Індивідуальні результати");
    expect(report.viewHtml).toContain("Ч 5-6");
    expect(report.pdfHtml).toContain("Індивідуальні результати");
    expect(report.viewHtml).not.toContain("Командні результати");
    expect(report.pdfHtml).not.toContain("Командні результати");
    expect(report.viewHtml).toContain('class="page"');
    expect(report.pdfHtml).toContain("@page");
  });

  it("builds an empty individual report when there are no participants yet", () => {
    const report = generateIndividualReportHtml(emptyIndividualXml);

    expect(report.reportType).toBe("individual");
    expect(report.itemCount).toBe(0);
    expect(report.viewHtml).toContain("Індивідуальні результати");
    expect(report.pdfHtml).toContain("Індивідуальні результати");
    expect(report.viewHtml).not.toContain("<tbody>");
  });

  it("embeds configured report logos from paths relative to config.json", () => {
    const logos = useConfiguredLogoConfig();

    const report = generateIndividualReportHtml(sampleXml);

    expect(report.pdfHtml).toContain(logos.leftLogo);
    expect(report.pdfHtml).toContain(logos.rightLogo);
  });
});

describe("generateIndividualReportHtml with side-by-side scoring", () => {
  it("recreates the side-by-side individual report from the example config", () => {
    useIndividualExampleConfig("side-by-side");

    const report = generateIndividualReportHtml(sampleXml);

    expect(report.viewHtml).toContain("Заданий напрямок");
    expect(report.pdfHtml).toContain("Командні результати");
    expect(report.pdfHtml).toContain("<h4>Чоловіки</h4>");
    expect(report.pdfHtml).toContain("<h4>Жінки</h4>");
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

describe("generateRelayReportHtml", () => {
  it("builds relay report html from TeamResult IOF XML", () => {
    const report = generateRelayReportHtml(rogainingXml);

    expect(report.reportType).toBe("relay");
    expect(report.itemCount).toBeGreaterThan(0);
    expect(report.viewHtml).toContain("Естафета");
    expect(report.viewHtml).toContain("<th>Учасники</th>");
    expect(report.viewHtml).toContain("<th>Відст.</th>");
    expect(report.viewHtml).not.toContain("Командні результати");
    expect(report.pdfHtml).toContain("Командні результати");
    expect(report.pdfHtml).toContain("@page");
  });

  it("builds an empty relay report when there are no teams yet", () => {
    const report = generateRelayReportHtml(emptyRelayXml);

    expect(report.reportType).toBe("relay");
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

describe("generateIndividualRogainingReportHtml", () => {
  it("builds an individual rogaining report from XML scores", () => {
    const report = generateIndividualRogainingReportHtml(sideBySideRogainingXml);

    expect(report.reportType).toBe("individual-rogaining");
    expect(report.itemCount).toBeGreaterThan(0);
    expect(report.viewHtml).toContain("Рогейн");
    expect(report.viewHtml).toContain("<th>Бал</th>");
    expect(report.viewHtml).not.toContain("<th>Команда</th>");
    expect(report.viewHtml).not.toContain("<th>Кількість КП</th>");
    expect(report.viewHtml).not.toContain("<th>Відст.</th>");
    expect(report.pdfHtml).not.toContain("Командні результати");
  });
});

describe("generateSummaryTeamReportHtml", () => {
  it("builds a team summary from configured report sources", () => {
    setConfigPath(path.resolve(__dirname, "../../config-summary-team-side-by-side.json"));
    const report = generateSummaryTeamReportHtml(sampleXml, {
      summaryTeamSeriesXmls: [
        { type: "individual", xml: sampleXml },
        { type: "side-by-side-rogaining", xml: sideBySideRogainingXml },
        { type: "relay", xml: rogainingXml },
      ],
    });

    expect(report.reportType).toBe("summary-team");
    expect(report.supportsView).toBe(false);
    expect(report.itemCount).toBeGreaterThan(0);
    expect(report.pdfHtml).toContain('<th class="points-cell">В заданому напрямку</th>');
    expect(report.pdfHtml).toContain('<th class="points-cell">По вибору</th>');
    expect(report.pdfHtml).toContain('<th class="points-cell">Естафета</th>');
    expect(report.pdfHtml).toContain('<th class="points-cell">Сума</th>');
    expect(report.pdfHtml).toContain("@page");
  });

  it("uses the explicit series order", () => {
    setConfigPath(path.resolve(__dirname, "../../config-summary-team-side-by-side.json"));
    const report = generateSummaryTeamReportHtml(sampleXml, {
      summaryTeamSeriesXmls: [
        { type: "side-by-side-rogaining", xml: sideBySideRogainingXml },
        { type: "relay", xml: rogainingXml },
      ],
    });

    expect(report.reportType).toBe("summary-team");
    expect(report.pdfHtml).not.toContain('<th class="points-cell">В заданому напрямку</th>');
    expectInOrder(report.pdfHtml, [
      '<th class="points-cell">По вибору</th>',
      '<th class="points-cell">Естафета</th>',
      '<th class="points-cell">Сума</th>',
    ]);
  });

  it("uses explicit labels for duplicate source types", () => {
    setConfigPath(path.resolve(__dirname, "../../config-summary-team-side-by-side.json"));
    const report = generateSummaryTeamReportHtml(sampleXml, {
      summaryTeamSeriesXmls: [
        { type: "individual", label: "День 1", xml: sampleXml },
        { type: "individual", label: "День 2", xml: sampleXml },
      ],
    });

    expect(report.reportType).toBe("summary-team");
    expect(report.pdfHtml).toContain('<th class="points-cell">День 1</th>');
    expect(report.pdfHtml).toContain('<th class="points-cell">День 2</th>');
    expect(report.pdfHtml).not.toContain('<th class="points-cell">День 1 1</th>');
  });

  it("loads configured summary series with paths relative to the config file", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "iof-reports-summary-series-"));
    const dataDir = path.join(tempDir, "data");
    const configPath = path.join(tempDir, "config.json");
    const day1Path = path.join(dataDir, "day1.xml");
    const day2Path = path.join(dataDir, "day2.xml");

    tempConfigDirs.push(tempDir);
    fs.mkdirSync(dataDir);
    fs.writeFileSync(day1Path, "<ResultList />");
    fs.writeFileSync(day2Path, "<ResultList />");
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        summaryTeam: {
          series: [
            { type: "individual", path: "data/day1.xml", label: "День 1" },
            { type: "choice", path: "data/day2.xml", label: "Вибір" },
          ],
        },
      }),
    );
    setConfigPath(configPath);

    expect(loadConfig().summaryTeam.series).toEqual([
      { type: "individual", path: day1Path, label: "День 1" },
      { type: "side-by-side-rogaining", path: day2Path, label: "Вибір" },
    ]);
  });
});

describe("generateSummaryReportHtml", () => {
  it("builds an individual summary from configured report sources", () => {
    const report = generateSummaryReportHtml(sampleXml, {
      summarySeriesXmls: [
        { type: "individual", label: "День 1", xml: sampleXml },
        { type: "individual", label: "День 2", xml: sampleXml },
      ],
    });

    expect(report.reportType).toBe("summary");
    expect(report.supportsView).toBe(false);
    expect(report.itemCount).toBeGreaterThan(0);
    expect(report.pdfHtml).toContain("Підсумкові результати");
    expect(report.pdfHtml).toContain('<th class="points-cell">День 1</th>');
    expect(report.pdfHtml).toContain('<th class="points-cell">День 2</th>');
    expect(report.pdfHtml).toContain('<th class="points-cell">Сума</th>');
    expect(report.pdfHtml).toContain("Ч 5-6");
    expect(report.pdfHtml).toContain("@page");
  });

  it("requires at least one series source", () => {
    expect(() => generateSummaryReportHtml(sampleXml)).toThrow(
      "at least one --series source",
    );
  });

  it("loads configured summary series with paths relative to the config file", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "iof-reports-summary-"));
    const dataDir = path.join(tempDir, "data");
    const configPath = path.join(tempDir, "config.json");
    const day1Path = path.join(dataDir, "day1.xml");
    const day2Path = path.join(dataDir, "day2.xml");

    tempConfigDirs.push(tempDir);
    fs.mkdirSync(dataDir);
    fs.writeFileSync(day1Path, "<ResultList />");
    fs.writeFileSync(day2Path, "<ResultList />");
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        summary: {
          series: [
            { type: "individual", path: "data/day1.xml", label: "День 1" },
            { type: "individual", path: "data/day2.xml", label: "День 2" },
          ],
        },
      }),
    );
    setConfigPath(configPath);

    expect(loadConfig().summary.series).toEqual([
      { type: "individual", path: day1Path, label: "День 1" },
      { type: "individual", path: day2Path, label: "День 2" },
    ]);
  });
});

describe("generateIndividualReportHtml with military scoring", () => {
  it("builds military individual report html from IOF XML", () => {
    useIndividualExampleConfig("military");

    const report = generateIndividualReportHtml(sampleXml);

    expect(report.reportType).toBe("individual");
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
    useIndividualExampleConfig("military");

    const report = generateIndividualReportHtml(emptyIndividualXml);

    expect(report.reportType).toBe("individual");
    expect(report.itemCount).toBe(0);
    expect(report.viewHtml).toContain("Довга дистанція");
    expect(report.pdfHtml).toContain("Довга дистанція");
    expect(report.viewHtml).not.toContain("<tbody>");
  });

  it("separates military individual team results by ВВНЗ and ЗСУ groups", () => {
    useIndividualExampleConfig("military");

    const report = generateIndividualReportHtml(militaryLongXml);

    expect(report.pdfHtml).toContain("Командні результати");
    expect(report.pdfHtml).toContain("<h4>ВВНЗ</h4>");
    expect(report.pdfHtml).toContain("<h4>ЗСУ</h4>");
  });

  it("orders military individual class tables by configured team groups", () => {
    useIndividualExampleConfig("military");

    const report = generateIndividualReportHtml(militaryLongXml);

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

describe("military relay config", () => {
  it("builds military relay report html from TeamResult IOF XML", () => {
    setConfigPath(path.resolve(__dirname, "../../config-relay-military.json"));
    const report = generateRelayReportHtml(rogainingXml);

    expect(report.reportType).toBe("relay");
    expect(report.itemCount).toBeGreaterThan(0);
    expect(report.viewHtml).toContain("Естафета");
    expect(report.viewHtml).toContain("<th>Учасники</th>");
    expect(report.viewHtml).toContain("<th>Відст.</th>");
    expect(report.viewHtml).not.toContain("Загальнокомандний результат");
    expect(report.pdfHtml).toContain("Загальнокомандний результат");
    expect(report.pdfHtml).toContain("@page");
  });

  it("builds an empty military relay report when there are no teams yet", () => {
    setConfigPath(path.resolve(__dirname, "../../config-relay-military.json"));
    const report = generateRelayReportHtml(emptyRelayXml);

    expect(report.reportType).toBe("relay");
    expect(report.itemCount).toBe(0);
    expect(report.eventName).toBe("Естафета");
    expect(report.viewHtml).toContain("Естафета");
    expect(report.pdfHtml).toContain("Естафета");
    expect(report.viewHtml).not.toContain("<tbody>");
  });

  it("marks military relay teams with problem statuses in view and pdf", () => {
    setConfigPath(path.resolve(__dirname, "../../config-relay-military.json"));
    const report = generateRelayReportHtml(militaryRelayXml);
    const viewRow = expectRowContaining(report.viewHtml, "ЖВІ - 4");
    const pdfRow = expectRowContaining(report.pdfHtml, "ЖВІ - 4");

    expect(viewRow).toContain('data-status="MissingPunch"');
    expect(viewRow).toContain("<td>Не всі КП</td>");
    expect(viewRow).toContain("<td><strong>0</strong></td>");
    expect(viewRow).not.toContain("<td>OK</td>");
    expect(pdfRow).toContain("<td>Не всі КП</td>");
    expect(pdfRow).toContain('<td class="points-cell"><strong>0</strong></td>');
    expect(pdfRow).not.toContain("<td>OK</td>");
  });
});

describe("generateSummaryTeamReportHtml with military config", () => {
  it("builds grouped military team summary from configured sources", () => {
    setConfigPath(path.resolve(__dirname, "../../config-summary-team-military.json"));
    const report = generateSummaryTeamReportHtml(militaryLongXml, {
      summaryTeamSeriesXmls: [
        { type: "individual", xml: militaryLongXml },
        { type: "relay", xml: militaryRelayXml },
      ],
    });

    expect(report.reportType).toBe("summary-team");
    expect(report.supportsView).toBe(false);
    expect(report.itemCount).toBeGreaterThan(0);
    expect(report.pdfHtml).toContain("Командний підсумок");
    expect(report.pdfHtml).toContain("<h3>ВВНЗ</h3>");
    expect(report.pdfHtml).toContain("<h3>ЗСУ</h3>");
    expect(report.pdfHtml).toContain('<th class="points-cell">Індивідуальні очки</th>');
    expect(report.pdfHtml).toContain('<th class="points-cell">Естафетні очки</th>');
  });

  it("requires at least one series source", () => {
    expect(() => generateSummaryTeamReportHtml(sampleXml)).toThrow(
      "at least one --series source",
    );
  });

  it("builds an empty grouped summary when all sources are empty", () => {
    setConfigPath(path.resolve(__dirname, "../../config-summary-team-military.json"));
    const report = generateSummaryTeamReportHtml(emptyIndividualXml, {
      summaryTeamSeriesXmls: [
        { type: "individual", xml: emptyIndividualXml },
        { type: "relay", xml: emptyRelayXml },
      ],
    });

    expect(report.reportType).toBe("summary-team");
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
    expect(report.viewHtml).toContain("Рогейн");
    expect(report.viewHtml).toContain("<th>Команда</th>");
    expect(report.viewHtml).toContain(">ALL</h3>");
    expect(report.pdfHtml).toContain("Рогейн");
    expect(report.pdfHtml).not.toContain(">ALL</h3>");
    expect(report.viewHtml).toContain('class="page"');
    expect(report.pdfHtml).toContain("@page");
  });

  it("builds awards mode from the regular rogaining report", () => {
    const regularReport = generateRogainingReportHtml(rogainingXml);
    const awardsReport = generateRogainingReportHtml(rogainingXml, {
      awardsOnly: true,
    });

    expect(awardsReport.reportType).toBe("rogaining");
    expect(awardsReport.pdfHtml).toContain("Нагородний");
    expect(regularReport.pdfHtml).toContain('<td class="place-cell"><strong>4</strong></td>');
    expect(awardsReport.pdfHtml).not.toContain('<td class="place-cell"><strong>4</strong></td>');
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
    expect(report.viewHtml).toContain(
      '<th class="score-doc-points-cell">очки рейтин-гу</th>',
    );
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
      generateIndividualReportHtml(sampleXml),
      generateRelayReportHtml(rogainingXml),
      generateSummaryTeamReportHtml(sampleXml, {
        summaryTeamSeriesXmls: [
          { type: "side-by-side-rogaining", xml: sideBySideRogainingXml },
          { type: "relay", xml: rogainingXml },
        ],
      }),
      generateRogainingReportHtml(rogainingXml),
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
  it("builds the default regular individual report for all mode", () => {
    const reports = generateReportsHtml(sampleXml, "all");

    expect(reports).toHaveLength(1);
    expect(reports[0].reportType).toBe("individual");
    expect(reports[0].pdfHtml).toContain("Індивідуальні результати");
    expect(reports[0].pdfHtml).not.toContain("Командні результати");
  });
});

describe("generateReportHtml", () => {
  it("dispatches to individual report generator", () => {
    const report = generateReportHtml(sampleXml, "individual");

    expect(report.reportType).toBe("individual");
    expect(report.viewHtml).toContain("Індивідуальні результати");
    expect(report.pdfHtml).toContain("Індивідуальні результати");
  });

  it("dispatches to individual rogaining report generator", () => {
    const report = generateReportHtml(sideBySideRogainingXml, "individual-rogaining");

    expect(report.reportType).toBe("individual-rogaining");
    expect(report.viewHtml).toContain("Рогейн");
  });

  it("uses configured rogaining report title for rogaining reports", () => {
    setConfigPath(path.resolve(__dirname, "../__fixtures__/rogaining-report-title-config.json"));

    const individualReport = generateIndividualRogainingReportHtml(sideBySideRogainingXml);
    const teamReport = generateRogainingReportHtml(rogainingXml);

    expect(individualReport.viewHtml).toContain("Кастомний рогейн");
    expect(teamReport.viewHtml).toContain("Кастомний рогейн");
  });

  it("dispatches to relay report generator", () => {
    const report = generateReportHtml(rogainingXml, "relay");

    expect(report.reportType).toBe("relay");
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

  it("dispatches to summary-team report generator", () => {
    const report = generateReportHtml(sampleXml, "summary-team", {
      summaryTeamSeriesXmls: [
        { type: "side-by-side-rogaining", xml: sideBySideRogainingXml },
        { type: "relay", xml: rogainingXml },
      ],
    });

    expect(report.reportType).toBe("summary-team");
    expect(report.pdfHtml).toContain("Командний підсумок");
  });

  it("dispatches to summary report generator", () => {
    const report = generateReportHtml(sampleXml, "summary", {
      summarySeriesXmls: [
        { type: "individual", label: "День 1", xml: sampleXml },
        { type: "individual", label: "День 2", xml: sampleXml },
      ],
    });

    expect(report.reportType).toBe("summary");
    expect(report.pdfHtml).toContain("Підсумкові результати");
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

  it("dispatches to grouped summary-team with military config", () => {
    setConfigPath(path.resolve(__dirname, "../../config-summary-team-military.json"));
    const teamReport = generateReportHtml(sampleXml, "summary-team", {
      summaryTeamSeriesXmls: [
        { type: "individual", xml: sampleXml },
        { type: "relay", xml: rogainingXml },
      ],
    });

    expect(teamReport.reportType).toBe("summary-team");
  });
});
