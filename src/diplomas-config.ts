export const DIPLOMA_FIELDS = ["participantName", "teamName", "className", "place"] as const;
export type DiplomaFieldName = (typeof DIPLOMA_FIELDS)[number];

export type DiplomaFieldConfig = {
  enabled: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontWeight: number;
  align: "left" | "center" | "right";
};

export type DiplomasConfig = {
  page: { width: number; height: number };
  fontFamily: string;
  color: string;
  teamMode: "members" | "team";
  fields: Record<DiplomaFieldName, DiplomaFieldConfig>;
};

const fieldDefaults = { enabled: true, fontWeight: 600, align: "center" as const };
export const defaultDiplomasConfig: DiplomasConfig = {
  page: { width: 210, height: 297 },
  fontFamily: "Shantell Sans",
  color: "#1f2c27",
  teamMode: "members",
  fields: {
    participantName: { ...fieldDefaults, x: 16, y: 84, width: 178, height: 9, fontSize: 20 },
    teamName: { ...fieldDefaults, enabled: false, x: 53, y: 98, width: 144, height: 9, fontSize: 18 },
    place: { ...fieldDefaults, x: 29, y: 113, width: 25, height: 8, fontSize: 20, fontWeight: 700 },
    className: { ...fieldDefaults, x: 132, y: 113, width: 48, height: 8, fontSize: 16 },
  },
};

function object(value: unknown, label: string): Record<string, unknown> {
  if (value === undefined) return {};
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function number(value: unknown, label: string, minimum: number): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum) {
    throw new Error(`${label} must be a finite number >= ${minimum}.`);
  }
}

export function normalizeDiplomasConfig(raw: unknown): DiplomasConfig {
  const input = object(raw, "diplomas");
  const page = { ...defaultDiplomasConfig.page, ...object(input.page, "diplomas.page") };
  number(page.width, "diplomas.page.width", 1);
  number(page.height, "diplomas.page.height", 1);
  const fields = { ...defaultDiplomasConfig.fields };
  const inputFields = object(input.fields, "diplomas.fields");
  for (const key of Object.keys(inputFields)) {
    if (!DIPLOMA_FIELDS.includes(key as DiplomaFieldName)) {
      throw new Error(`Unknown diploma field: ${key}.`);
    }
  }
  for (const key of DIPLOMA_FIELDS) {
    const label = `diplomas.fields.${key}`;
    const field = { ...fields[key], ...object(inputFields[key], label) };
    for (const prop of ["x", "y"] as const) number(field[prop], `${label}.${prop}`, 0);
    for (const prop of ["width", "height", "fontSize"] as const) number(field[prop], `${label}.${prop}`, 0.1);
    number(field.fontWeight, `${label}.fontWeight`, 1);
    if (field.fontWeight > 1000) throw new Error(`${label}.fontWeight must be <= 1000.`);
    if (typeof field.enabled !== "boolean") throw new Error(`${label}.enabled must be a boolean.`);
    if (!["left", "center", "right"].includes(field.align)) throw new Error(`${label}.align must be left, center, or right.`);
    if (field.enabled && (field.x + field.width > page.width || field.y + field.height > page.height)) {
      throw new Error(`${label} extends outside the diploma page.`);
    }
    fields[key] = field;
  }
  const teamMode = input.teamMode ?? defaultDiplomasConfig.teamMode;
  if (teamMode !== "members" && teamMode !== "team") throw new Error("diplomas.teamMode must be members or team.");
  const fontFamily = input.fontFamily ?? defaultDiplomasConfig.fontFamily;
  if (typeof fontFamily !== "string" || !/^[\p{L}\p{N} ,_-]+$/u.test(fontFamily)) {
    throw new Error("diplomas.fontFamily must be a font name or comma-separated font names.");
  }
  const color = input.color ?? defaultDiplomasConfig.color;
  if (typeof color !== "string" || !/^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(color)) {
    throw new Error("diplomas.color must be a hex color, e.g. #111111.");
  }
  return { page, fields, teamMode, fontFamily, color };
}
