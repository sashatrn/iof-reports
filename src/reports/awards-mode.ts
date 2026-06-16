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
