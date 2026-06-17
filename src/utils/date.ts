export function parseIsoDate(dateStr?: string): Date | undefined {
  if (!dateStr) return undefined;

  const parts = dateStr.split("-");
  if (parts.length !== 3) return undefined;

  const [yearStr, monthStr, dayStr] = parts;

  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
    return undefined;
  }

  // month у Date: 0-11
  return new Date(year, month - 1, day);
}

export function formatDate(
  date: Date | undefined,
  pattern: "dd.MM.yyyy" | "yyyy" | "MM.yyyy" = "dd.MM.yyyy",
): string {
  if (!date) return "";

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear());

  switch (pattern) {
    case "dd.MM.yyyy":
      return `${day}.${month}.${year}`;
    case "yyyy":
      return year;
    case "MM.yyyy":
      return `${month}.${year}`;
    default:
      return `${day}.${month}.${year}`;
  }
}

function compareDates(left: Date, right: Date): number {
  return new Date(left.getFullYear(), left.getMonth(), left.getDate()).getTime() -
    new Date(right.getFullYear(), right.getMonth(), right.getDate()).getTime();
}

export function formatDateRange(dates: Date[]): string {
  if (dates.length === 0) {
    return "";
  }

  const sortedDates = [...dates].sort(compareDates);
  const firstDate = sortedDates[0];
  const lastDate = sortedDates[sortedDates.length - 1];

  if (compareDates(firstDate, lastDate) === 0) {
    return formatDate(firstDate);
  }

  const firstDay = String(firstDate.getDate()).padStart(2, "0");
  const firstMonth = String(firstDate.getMonth() + 1).padStart(2, "0");
  const firstYear = String(firstDate.getFullYear());
  const lastDay = String(lastDate.getDate()).padStart(2, "0");
  const lastMonth = String(lastDate.getMonth() + 1).padStart(2, "0");
  const lastYear = String(lastDate.getFullYear());

  if (
    firstDate.getFullYear() === lastDate.getFullYear() &&
    firstDate.getMonth() === lastDate.getMonth()
  ) {
    return `${firstDay}-${lastDay}.${lastMonth}.${lastYear}`;
  }

  if (firstDate.getFullYear() === lastDate.getFullYear()) {
    return `${firstDay}.${firstMonth}-${lastDay}.${lastMonth}.${lastYear}`;
  }

  return `${firstDay}.${firstMonth}.${firstYear}-${lastDay}.${lastMonth}.${lastYear}`;
}
