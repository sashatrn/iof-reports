import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { parseCourseData } from "./parse-course-data";

const coursesXml = fs.readFileSync(
  path.resolve(__dirname, "../__fixtures__/courses.xml"),
  "utf-8",
);

describe("parseCourseData", () => {
  it("parses controls with map and geographic positions", () => {
    const parsed = parseCourseData(coursesXml);

    expect(parsed.scale).toBe(10000);
    expect(parsed.controls).toHaveLength(70);
    expect(parsed.controls[0]).toEqual({
      id: "S1",
      lat: 50.373541,
      lng: 29.1684,
      mapX: -383.3,
      mapY: -5.6,
      mapUnit: "mm",
    });
    expect(parsed.controls.some((control) => control.id === "22")).toBe(true);
    expect(parsed.controls.some((control) => control.id === "110")).toBe(true);
  });
});
