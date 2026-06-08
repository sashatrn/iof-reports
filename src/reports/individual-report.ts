import {
  loadConfig,
  type AppConfig,
  type ClassGroupConfig,
} from "../config";
import { Participant } from "../io/parse-iof";
import { renderTemplate } from "../render/template-engine";
import { formatDate } from "../utils/date";
import { isPdfVisibleParticipant } from "./pdf-status-filter";
import { getLeftLogo } from "./report-logos";
import { type GenderIndividualTeamResults } from "./individual-gender-team-results";
import {
  buildGroupedIndividualTeamResults,
  type GroupedIndividualTeamResults,
} from "./individual-team-results";

type HtmlVariant = "view" | "pdf";

type IndividualTeamResults =
  | {
      mode: "gender";
      men: GenderIndividualTeamResults["men"];
      women: GenderIndividualTeamResults["women"];
    }
  | {
      mode: "grouped";
      groups: GroupedIndividualTeamResults[];
    };

type ClassGroupMatcher = ClassGroupConfig & { regex: RegExp };

function formatTime(sec?: number): string {
  if (sec === undefined) {
    return "";
  }

  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const seconds = sec % 60;

  return `${hours > 0 ? `${hours}:` : ""}${String(minutes).padStart(2, "0")}:${String(
    seconds,
  ).padStart(2, "0")}`;
}

function formatTimeBehind(sec?: number): string {
  if (sec === undefined || sec === 0) {
    return "";
  }

  const sign = sec < 0 ? "-" : "+";
  const absoluteSeconds = Math.abs(sec);
  const minutes = Math.floor(absoluteSeconds / 60);
  const seconds = Math.floor(absoluteSeconds % 60);

  return `${sign}${minutes}:${String(seconds).padStart(2, "0")}`;
}

function buildClassGroupMatchers(
  groups: ClassGroupConfig[],
): ClassGroupMatcher[] {
  return groups.map((group, index) => {
    try {
      return {
        ...group,
        regex: new RegExp(group.classRegex),
      };
    } catch (error) {
      throw new Error(
        `Invalid individual.classOrderGroups[${index}].classRegex: ${(error as Error).message}`,
      );
    }
  });
}

function getClassGroupIndex(className: string, groupMatchers: ClassGroupMatcher[]): number {
  const groupIndex = groupMatchers.findIndex((group) => group.regex.test(className));
  return groupIndex === -1 ? Number.MAX_SAFE_INTEGER : groupIndex;
}

function compareClassNames(
  left: string,
  right: string,
  classOrder: AppConfig["individual"]["classOrder"],
  groupMatchers: ClassGroupMatcher[],
): number {
  if (classOrder !== "grouped") {
    return left.localeCompare(right, "uk");
  }

  const groupDiff =
    getClassGroupIndex(left, groupMatchers) - getClassGroupIndex(right, groupMatchers);

  if (groupDiff !== 0) {
    return groupDiff;
  }

  return left.localeCompare(right, "uk");
}

function renderIndividualTemplateText(
  template: string | undefined,
  eventDate: Date,
  config: AppConfig,
): string | undefined {
  return template
    ?.replaceAll("{{stage}}", config.reportHeader.stage)
    .replaceAll("{{region_of}}", config.reportHeader.region_of)
    .replaceAll("{{year}}", formatDate(eventDate, "yyyy"));
}

function buildEvent(eventDate: Date, config: AppConfig) {
  return {
    reportTitle: config.individual.reportTitle,
    event: {
      title:
        config.reportHeader.title ??
        renderIndividualTemplateText(config.individual.title, eventDate, config),
      subtitle: renderIndividualTemplateText(
        config.individual.subtitle,
        eventDate,
        config,
      ),
      location: config.reportHeader.location,
      date: formatDate(eventDate),
      logo1: getLeftLogo(config, "logo1.png"),
      logo2: config.rightLogo,
    },
    officials: config.officials,
  };
}

function buildTeamResults(
  participants: Participant[],
  config: AppConfig,
  genderTeamResults?: GenderIndividualTeamResults,
): IndividualTeamResults | undefined {
  if (config.individual.teamResults === "grouped") {
    return {
      mode: "grouped",
      groups: buildGroupedIndividualTeamResults(
        participants,
        config.individual.teamFilterRegex,
        config.individual.classFilterRegex,
        config.individual.classOrderGroups,
      ),
    };
  }

  if (!genderTeamResults) {
    return undefined;
  }

  return {
    mode: "gender",
    men: genderTeamResults.men,
    women: genderTeamResults.women,
  };
}

export function buildIndividualHtml(
  participants: Participant[],
  eventDate: Date,
  variant: HtmlVariant = "pdf",
  genderTeamResults?: GenderIndividualTeamResults,
): string {
  const config = loadConfig();
  const groupMatchers = buildClassGroupMatchers(config.individual.classOrderGroups);
  const reportParticipants =
    variant === "pdf" ? participants.filter(isPdfVisibleParticipant) : participants;
  const byClass = new Map<string, Participant[]>();

  for (const participant of reportParticipants) {
    const classParticipants = byClass.get(participant.className) ?? [];
    classParticipants.push(participant);
    byClass.set(participant.className, classParticipants);
  }

  const classes = [...byClass.keys()]
    .sort((left, right) =>
      compareClassNames(left, right, config.individual.classOrder, groupMatchers),
    )
    .map((className) => ({
      name: className,
      participants: [...(byClass.get(className) ?? [])]
        .sort((left, right) => {
          const positionDiff = (left.position ?? 9999) - (right.position ?? 9999);
          return positionDiff !== 0 ? positionDiff : left.name.localeCompare(right.name, "uk");
        })
        .map((participant) => ({
          position: participant.position ?? "",
          name: participant.name,
          organisation: participant.club,
          time: formatTime(participant.timeSec),
          timeBehind: formatTimeBehind(participant.timeBehindSec),
          points: participant.points,
          status: participant.status,
        })),
    }));

  return renderTemplate(`individual-${variant}.njk`, {
    ...buildEvent(eventDate, config),
    classes,
    teamResults: buildTeamResults(
      reportParticipants,
      config,
      genderTeamResults,
    ),
  });
}
