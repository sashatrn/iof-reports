import { describe, expect, it } from "vitest";
import { formatDateRange, parseIsoDate } from "./date";

function date(value: string): Date {
  return parseIsoDate(value)!;
}

describe("formatDateRange", () => {
  it("formats a single date", () => {
    expect(formatDateRange([date("2026-06-14")])).toBe("14.06.2026");
  });

  it("formats a range within one month", () => {
    expect(formatDateRange([date("2026-06-15"), date("2026-06-14")])).toBe("14-15.06.2026");
  });

  it("formats a range across months within one year", () => {
    expect(formatDateRange([date("2026-05-30"), date("2026-06-02")])).toBe("30.05-02.06.2026");
  });

  it("formats a range across years", () => {
    expect(formatDateRange([date("2025-12-31"), date("2026-01-01")])).toBe("31.12.2025-01.01.2026");
  });
});
