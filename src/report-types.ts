export const REPORT_TYPES = ["all", "individual", "team", "rogaining"] as const;

export type ReportType = (typeof REPORT_TYPES)[number];
export type SingleReportType = Exclude<ReportType, "all">;

export function isReportType(value: string): value is ReportType {
  return REPORT_TYPES.includes(value as ReportType);
}

export function isSingleReportType(value: string): value is SingleReportType {
  return value === "individual" || value === "team" || value === "rogaining";
}
