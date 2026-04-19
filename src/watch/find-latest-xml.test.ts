import fs from "fs";
import os from "os";
import path from "path";
import { describe, expect, it } from "vitest";
import { findLatestXml } from "./find-latest-xml";

describe("findLatestXml", () => {
  it("returns the latest xml file by mtime", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "iof-watch-"));
    const olderPath = path.join(tempDir, "001.xml");
    const newerPath = path.join(tempDir, "002.xml");

    fs.writeFileSync(olderPath, "<xml />");
    fs.writeFileSync(newerPath, "<xml />");

    const now = Date.now();
    fs.utimesSync(olderPath, now / 1000 - 10, now / 1000 - 10);
    fs.utimesSync(newerPath, now / 1000, now / 1000);

    const latest = findLatestXml(tempDir);

    expect(latest?.name).toBe("002.xml");
    expect(latest?.path).toBe(newerPath);
  });
});
