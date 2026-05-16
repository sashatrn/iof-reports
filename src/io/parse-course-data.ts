import { XMLParser } from "fast-xml-parser";

export type CourseControlPoint = {
  id: string;
  lat?: number;
  lng?: number;
  mapX?: number;
  mapY?: number;
  mapUnit?: string;
};

export type ParsedCourseData = {
  scale?: number;
  controls: CourseControlPoint[];
};

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined || value === null) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }

  return undefined;
}

export function parseCourseData(xml: string): ParsedCourseData {
  const parser = new XMLParser({
    ignoreAttributes: false,
    removeNSPrefix: true,
  });

  const json = parser.parse(xml);
  const raceCourseData = json?.CourseData?.RaceCourseData;
  const raceCourseDataEntries = asArray(raceCourseData);
  const firstRaceCourseData = raceCourseDataEntries[0];
  const scale = toNumber(firstRaceCourseData?.Map?.Scale);
  const controls = raceCourseDataEntries.flatMap((entry) => {
    return asArray(entry?.Control)
      .map((control) => {
        const id = String(control?.Id ?? "").trim();

        return {
          id,
          lat: toNumber(control?.Position?.["@_lat"]),
          lng: toNumber(control?.Position?.["@_lng"]),
          mapX: toNumber(control?.MapPosition?.["@_x"]),
          mapY: toNumber(control?.MapPosition?.["@_y"]),
          mapUnit: control?.MapPosition?.["@_unit"],
        };
      })
      .filter((control) => control.id !== "");
  });

  return {
    scale,
    controls,
  };
}
