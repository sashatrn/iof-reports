import { XMLParser } from "fast-xml-parser";

export type UofBazaSportsman = {
  fio: string;
  birthday: string;
  qualification: string;
  region: string;
  trainers: string[];
  group: string;
  club: string;
  chip: string;
  teamName: string;
};

export type ParsedUofBaza = {
  eventName?: string;
  sportsmen: UofBazaSportsman[];
};

const CP1251_SPECIALS: Record<number, string> = {
  0x80: "\u0402",
  0x81: "\u0403",
  0x82: "\u201A",
  0x83: "\u0453",
  0x84: "\u201E",
  0x85: "\u2026",
  0x86: "\u2020",
  0x87: "\u2021",
  0x88: "\u20AC",
  0x89: "\u2030",
  0x8a: "\u0409",
  0x8b: "\u2039",
  0x8c: "\u040A",
  0x8d: "\u040C",
  0x8e: "\u040B",
  0x8f: "\u040F",
  0x90: "\u0452",
  0x91: "\u2018",
  0x92: "\u2019",
  0x93: "\u201C",
  0x94: "\u201D",
  0x95: "\u2022",
  0x96: "\u2013",
  0x97: "\u2014",
  0x99: "\u2122",
  0x9a: "\u0459",
  0x9b: "\u203A",
  0x9c: "\u045A",
  0x9d: "\u045C",
  0x9e: "\u045B",
  0x9f: "\u045F",
  0xa0: "\u00A0",
  0xa1: "\u040E",
  0xa2: "\u045E",
  0xa3: "\u0408",
  0xa4: "\u00A4",
  0xa5: "\u0490",
  0xa6: "\u00A6",
  0xa7: "\u00A7",
  0xa8: "\u0401",
  0xa9: "\u00A9",
  0xaa: "\u0404",
  0xab: "\u00AB",
  0xac: "\u00AC",
  0xad: "\u00AD",
  0xae: "\u00AE",
  0xaf: "\u0407",
  0xb0: "\u00B0",
  0xb1: "\u00B1",
  0xb2: "\u0406",
  0xb3: "\u0456",
  0xb4: "\u0491",
  0xb5: "\u00B5",
  0xb6: "\u00B6",
  0xb7: "\u00B7",
  0xb8: "\u0451",
  0xb9: "\u2116",
  0xba: "\u0454",
  0xbb: "\u00BB",
  0xbc: "\u0458",
  0xbd: "\u0405",
  0xbe: "\u0455",
  0xbf: "\u0457",
};

function decodeWindows1251(buffer: Buffer): string {
  let decoded = "";

  for (const byte of buffer) {
    if (byte < 0x80) {
      decoded += String.fromCharCode(byte);
      continue;
    }

    if (byte >= 0xc0) {
      decoded += String.fromCharCode(0x0410 + byte - 0xc0);
      continue;
    }

    decoded += CP1251_SPECIALS[byte] ?? String.fromCharCode(byte);
  }

  return decoded;
}

function decodeXml(xml: string | Buffer): string {
  if (typeof xml === "string") {
    return xml;
  }

  const asciiHead = xml.subarray(0, 200).toString("ascii").toLowerCase();

  if (asciiHead.includes("windows-1251")) {
    return decodeWindows1251(xml);
  }

  return xml.toString("utf-8");
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined || value === null) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function uniqueNonEmpty(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = value.trim();

    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    result.push(normalized);
  }

  return result;
}

export function parseUofBaza(xml: string | Buffer): ParsedUofBaza {
  const parser = new XMLParser({
    ignoreAttributes: false,
    removeNSPrefix: true,
  });
  const decodedXml = decodeXml(xml);
  const json = parser.parse(decodedXml);
  const sportsmen = asArray(json?.UOFData?.Sportsman).map((sportsman) => ({
    fio: text(sportsman?.FIO),
    birthday: text(sportsman?.Birthday),
    qualification: text(sportsman?.Qualification),
    region: text(sportsman?.Region),
    trainers: uniqueNonEmpty(asArray(sportsman?.Trener).map(text)),
    group: text(sportsman?.Group),
    club: text(sportsman?.Club),
    chip: text(sportsman?.Chip),
    teamName: text(sportsman?.Prim),
  })).filter((sportsman) => sportsman.fio !== "");

  return {
    eventName: text(json?.UOFData?.Names) || undefined,
    sportsmen,
  };
}
