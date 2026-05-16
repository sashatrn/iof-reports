export const REPORT_TYPES = [
  "all",
  "individual",
  "team",
  "rogaining",
  "rogaining-awards",
  "rogaining-diplomas",
  "rogaining-score",
  "rogaining-results",
  "rogaining-results-score",
  "rogaining-splits",
  "military-individual",
  "military-relay",
  "military-team",
] as const;

export type ReportType = (typeof REPORT_TYPES)[number];
export type SingleReportType = Exclude<ReportType, "all">;

export function isReportType(value: string): value is ReportType {
  return REPORT_TYPES.includes(value as ReportType);
}

export function isSingleReportType(value: string): value is SingleReportType {
  return (
    value === "individual" ||
    value === "team" ||
    value === "rogaining" ||
    value === "rogaining-awards" ||
    value === "rogaining-diplomas" ||
    value === "rogaining-score" ||
    value === "rogaining-results" ||
    value === "rogaining-results-score" ||
    value === "rogaining-splits" ||
    value === "military-individual" ||
    value === "military-relay" ||
    value === "military-team"
  );
}
