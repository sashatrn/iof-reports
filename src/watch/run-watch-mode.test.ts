import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { ensureInitialWatchOutput } from "./run-watch-mode";

let tempDirs: string[] = [];

afterEach(() => {
  for (const tempDir of tempDirs) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  tempDirs = [];
});

describe("ensureInitialWatchOutput", () => {
  it("creates viewer files before the first XML export", () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "iof-watch-output-"));
    tempDirs.push(outputDir);

    ensureInitialWatchOutput(outputDir, "individual");

    expect(fs.existsSync(path.join(outputDir, "viewer.html"))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, "report.html"))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, "report.pdf.html"))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, "meta.json"))).toBe(true);
    expect(fs.readFileSync(path.join(outputDir, "report.html"), "utf-8"))
      .toContain("Очікування файлу з MeOS");
  });

  it("does not overwrite an existing generated report", () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "iof-watch-output-"));
    tempDirs.push(outputDir);
    const reportPath = path.join(outputDir, "report.html");
    fs.writeFileSync(reportPath, "<html>existing report</html>");

    ensureInitialWatchOutput(outputDir, "individual");

    expect(fs.readFileSync(reportPath, "utf-8")).toBe("<html>existing report</html>");
  });
});
