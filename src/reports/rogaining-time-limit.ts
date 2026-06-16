import { AppConfig } from "../config";

type TimedResult = {
  status: string;
  timeSec?: number;
};

function parseDuration(value: string, configField: string): number {
  const match = value.match(/^(\d+):([0-5]\d):([0-5]\d)$/);

  if (!match) {
    throw new Error(`Invalid ${configField} "${value}". Expected чч:мм:сс.`);
  }

  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
}

export function applyRogainingTimeLimit<T extends TimedResult>(
  results: T[],
  config: AppConfig,
): T[] {
  const { controlTime, allowedOvertime } = config.rogaining;

  if (controlTime === undefined || allowedOvertime === undefined) {
    return results;
  }

  const maximumTimeSec =
    parseDuration(controlTime, "rogaining.controlTime") +
    parseDuration(allowedOvertime, "rogaining.allowedOvertime");

  return results.map((result) => {
    if (
      result.status !== "OK" ||
      result.timeSec === undefined ||
      result.timeSec <= maximumTimeSec
    ) {
      return result;
    }

    return {
      ...result,
      status: "OverTime",
    };
  });
}
