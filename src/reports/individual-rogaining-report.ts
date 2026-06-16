import { loadConfig } from "../config";
import { Participant } from "../io/parse-iof";
import { renderTemplate } from "../render/template-engine";
import { formatDate } from "../utils/date";
import { isPdfVisibleParticipant } from "./pdf-status-filter";
import { getLeftLogo, getRightLogo } from "./report-logos";
import { applyRogainingTimeLimit } from "./rogaining-time-limit";
import {
  type AwardsModeOptions,
  filterAwardPlaces,
  sortAwardClasses,
  withAwardsSubtitle,
} from "./awards-mode";

type HtmlVariant = "view" | "pdf";

type IndividualRogainingParticipant = {
  position: string;
  name: string;
  time: string;
  score: number;
  penalty: number;
  totalScore: number;
  status: string;
};

export type IndividualRogainingClass = {
  name: string;
  participants: IndividualRogainingParticipant[];
};

function formatTime(sec?: number): string {
  if (sec === undefined) {
    return "";
  }

  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const seconds = Math.floor(sec % 60);

  return `${hours > 0 ? `${hours}:` : ""}${String(minutes).padStart(2, "0")}:${String(
    seconds,
  ).padStart(2, "0")}`;
}

function compareParticipants(left: Participant, right: Participant): number {
  const leftPlaceable = left.status === "OK";
  const rightPlaceable = right.status === "OK";

  if (leftPlaceable !== rightPlaceable) {
    return leftPlaceable ? -1 : 1;
  }

  if ((left.resultScore ?? 0) !== (right.resultScore ?? 0)) {
    return (right.resultScore ?? 0) - (left.resultScore ?? 0);
  }

  const timeDiff =
    (left.timeSec ?? Number.MAX_SAFE_INTEGER) -
    (right.timeSec ?? Number.MAX_SAFE_INTEGER);

  return timeDiff !== 0 ? timeDiff : left.name.localeCompare(right.name, "uk");
}

function buildClassParticipants(
  participants: Participant[],
): IndividualRogainingParticipant[] {
  let nextPlace = 1;

  return [...participants].sort(compareParticipants).map((participant) => {
    const position = participant.status === "OK" ? String(nextPlace) : "";
    const collectedScore =
      (participant.resultScore ?? 0) + (participant.resultPenalty ?? 0);
    const isOverTime = participant.status === "OverTime";

    if (position !== "") {
      nextPlace += 1;
    }

    return {
      position,
      name: participant.name,
      time: formatTime(participant.timeSec),
      score: collectedScore,
      penalty: isOverTime ? collectedScore : participant.resultPenalty ?? 0,
      totalScore: isOverTime ? 0 : participant.resultScore ?? 0,
      status: participant.status,
    };
  });
}

export function buildIndividualRogainingClasses(
  participants: Participant[],
  config = loadConfig(),
  options: AwardsModeOptions = {},
): IndividualRogainingClass[] {
  const byClass = new Map<string, Participant[]>();

  for (const participant of applyRogainingTimeLimit(participants, config)) {
    const classParticipants = byClass.get(participant.className) ?? [];
    classParticipants.push(participant);
    byClass.set(participant.className, classParticipants);
  }

  return sortAwardClasses([...byClass.keys()]
    .sort((left, right) => left.localeCompare(right, "uk"))
    .map((className) => ({
      name: className,
      participants: filterAwardPlaces(
        buildClassParticipants(byClass.get(className) ?? []),
        (participant) => participant.position,
        options,
      ),
    })), config.awards.classOrder, options);
}

export function buildIndividualRogainingHtml(
  participants: Participant[],
  eventDate: Date,
  variant: HtmlVariant = "pdf",
  options: AwardsModeOptions = {},
): string {
  const config = loadConfig();
  const reportParticipants =
    variant === "pdf" ? participants.filter(isPdfVisibleParticipant) : participants;

  return renderTemplate(`individual-rogaining-${variant}.njk`, {
    reportTitle: config.rogaining.reportTitle,
    event: withAwardsSubtitle({
      title:
        config.reportHeader.title ??
        `Протокол результатів рогейну, ${formatDate(eventDate)}`,
      subtitle: "",
      location: config.reportHeader.location,
      date: formatDate(eventDate),
      logo1: getLeftLogo(config, "logo1.png"),
      logo2: getRightLogo(config, "irf-logo.png"),
    }, options),
    officials: config.officials,
    classes: buildIndividualRogainingClasses(reportParticipants, config, options),
  });
}
