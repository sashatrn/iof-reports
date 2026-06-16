export type AwardsModeOptions = {
  awardsOnly?: boolean;
};

type EventWithSubtitle = {
  subtitle?: string;
};

export function withAwardsSubtitle<T extends EventWithSubtitle>(
  event: T,
  options: AwardsModeOptions = {},
): T {
  if (!options.awardsOnly) {
    return event;
  }

  return {
    ...event,
    subtitle: event.subtitle ? `${event.subtitle}<br/>Нагородний` : "Нагородний",
  };
}

export function isAwardPlace(place: unknown): boolean {
  const numericPlace = Number(place);
  return Number.isInteger(numericPlace) && numericPlace >= 1 && numericPlace <= 3;
}

export function filterAwardPlaces<T>(
  entries: T[],
  getPlace: (entry: T) => unknown,
  options: AwardsModeOptions = {},
): T[] {
  return options.awardsOnly
    ? entries.filter((entry) => isAwardPlace(getPlace(entry)))
    : entries;
}

export function filterAwardTop<T>(
  entries: T[],
  options: AwardsModeOptions = {},
): T[] {
  return options.awardsOnly ? entries.slice(0, 3) : entries;
}

function normalizeClassName(className: string): string {
  return className.trim().toLowerCase();
}

export function sortAwardClasses<T extends { name: string }>(
  classes: T[],
  classOrder: string[],
  options: AwardsModeOptions = {},
): T[] {
  if (!options.awardsOnly || classOrder.length === 0) {
    return classes;
  }

  const order = new Map(
    classOrder.map((className, index) => [normalizeClassName(className), index]),
  );

  return classes
    .map((classGroup, originalIndex) => ({
      classGroup,
      originalIndex,
      orderIndex: order.get(normalizeClassName(classGroup.name)) ?? Number.MAX_SAFE_INTEGER,
    }))
    .sort((left, right) => {
      if (left.orderIndex !== right.orderIndex) {
        return left.orderIndex - right.orderIndex;
      }

      return left.originalIndex - right.originalIndex;
    })
    .map((entry) => entry.classGroup);
}
