import { type AppConfig, type SideBySideAgeGroupConfig } from "../config";
import { type Participant } from "../io/parse-iof";

export type SideBySideCountedResult = {
  place: number;
  points: number;
};

export type SideBySideTeamResult = {
  place: number;
  organisation: string;
  points: number;
  countedResults: SideBySideCountedResult[];
};

export type SideBySideTeamResultGroup = {
  name: string;
  teams: SideBySideTeamResult[];
};

export type SideBySideScoredEntry = {
  className: string;
  organisation: string;
  label: string;
  place?: number;
  points: number;
};

type AgeGroupMatcher = SideBySideAgeGroupConfig & { regex: RegExp };

function normalizeOrganisation(organisation: string): string {
  return organisation.trim() || "Unknown";
}

function buildAgeGroupMatchers(config: AppConfig): AgeGroupMatcher[] {
  return config["side-by-side"].ageGroups.map((group, index) => {
    try {
      return { ...group, regex: new RegExp(group.classRegex) };
    } catch (error) {
      throw new Error(
        `Invalid side-by-side.ageGroups[${index}].classRegex: ${(error as Error).message}`,
      );
    }
  });
}

function compareCountedPlaces(
  left: SideBySideCountedResult[],
  right: SideBySideCountedResult[],
): number {
  const maxPlace = Math.max(
    0,
    ...left.map((result) => result.place),
    ...right.map((result) => result.place),
  );

  for (let place = 1; place <= maxPlace; place += 1) {
    const leftCount = left.filter((result) => result.place === place).length;
    const rightCount = right.filter((result) => result.place === place).length;

    if (leftCount !== rightCount) {
      return rightCount - leftCount;
    }
  }

  return 0;
}

export function compareSideBySideTeamResults(
  left: Pick<SideBySideTeamResult, "points" | "countedResults">,
  right: Pick<SideBySideTeamResult, "points" | "countedResults">,
): number {
  return right.points - left.points ||
    compareCountedPlaces(left.countedResults, right.countedResults);
}

function rankTeamResults(
  teams: Omit<SideBySideTeamResult, "place">[],
): SideBySideTeamResult[] {
  const sorted = [...teams].sort((left, right) =>
    compareSideBySideTeamResults(left, right) ||
    left.organisation.localeCompare(right.organisation, "uk"),
  );
  let previous: SideBySideTeamResult | undefined;

  return sorted.map((team, index) => {
    const place = previous && compareSideBySideTeamResults(previous, team) === 0
      ? previous.place
      : index + 1;
    const ranked = { ...team, place };
    previous = ranked;
    return ranked;
  });
}

function buildTeamResultGroups(
  entries: SideBySideScoredEntry[],
  config: AppConfig,
  countForGroup: (group: SideBySideAgeGroupConfig) => number,
): SideBySideTeamResultGroup[] {
  const matchers = buildAgeGroupMatchers(config);

  return matchers.map((group) => {
    const entriesByOrganisation = new Map<string, SideBySideScoredEntry[]>();

    for (const entry of entries) {
      if (!group.regex.test(entry.className)) continue;
      const organisation = normalizeOrganisation(entry.organisation);
      const organisationEntries = entriesByOrganisation.get(organisation) ?? [];
      organisationEntries.push(entry);
      entriesByOrganisation.set(organisation, organisationEntries);
    }

    const teams = [...entriesByOrganisation.entries()].map(([organisation, teamEntries]) => {
      const countedResults = teamEntries
        .filter((entry): entry is SideBySideScoredEntry & { place: number } =>
          entry.points > 0 && entry.place !== undefined,
        )
        .sort((left, right) =>
          right.points - left.points ||
          left.place - right.place ||
          left.label.localeCompare(right.label, "uk"),
        )
        .slice(0, countForGroup(group))
        .map(({ place, points }) => ({ place, points }));

      return {
        organisation,
        points: countedResults.reduce((sum, result) => sum + result.points, 0),
        countedResults,
      };
    }).filter((team) => team.points > 0);

    return {
      name: group.name,
      teams: rankTeamResults(teams),
    };
  }).filter((group) => group.teams.length > 0);
}

export function buildSideBySideIndividualTeamResults(
  participants: Participant[],
  config: AppConfig,
): SideBySideTeamResultGroup[] {
  return buildTeamResultGroups(
    participants.map((participant) => ({
      className: participant.className,
      organisation: participant.club,
      label: participant.name,
      place: participant.position,
      points: participant.points,
    })),
    config,
    (group) => group.individualResultCount,
  );
}

export function buildSideBySideTeamResultsFromEntries(
  entries: SideBySideScoredEntry[],
  config: AppConfig,
  resultType: "individual" | "relay",
): SideBySideTeamResultGroup[] {
  return buildTeamResultGroups(
    entries,
    config,
    resultType === "individual"
      ? (group) => group.individualResultCount
      : (group) => group.relayResultCount,
  );
}

// Legacy gender-separated mode remains available for older configuration files.
export type GenderTeamResult = {
  club: string;
  points: number;
};

function matchesPrefix(value: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => value.startsWith(prefix));
}

export function computeTeamResults(
  participants: Participant[],
  config: AppConfig,
  _logger?: unknown,
): { men: GenderTeamResult[]; women: GenderTeamResult[] } {
  const buildGenderResults = (prefixes: string[]) => {
    const classNames = new Set(
      participants
        .filter((participant) => matchesPrefix(participant.className, prefixes))
        .map((participant) => participant.className),
    );
    const byOrganisation = new Map<string, number>();

    for (const className of classNames) {
      const byClub = new Map<string, Participant[]>();
      for (const participant of participants.filter((entry) => entry.className === className)) {
        const clubParticipants = byClub.get(participant.club) ?? [];
        clubParticipants.push(participant);
        byClub.set(participant.club, clubParticipants);
      }
      for (const [club, clubParticipants] of byClub) {
        const points = clubParticipants
          .sort((left, right) => right.points - left.points)
          .slice(0, 2)
          .reduce((sum, participant) => sum + participant.points, 0);
        byOrganisation.set(club, (byOrganisation.get(club) ?? 0) + points);
      }
    }

    return [...byOrganisation.entries()]
      .map(([club, points]) => ({ club, points }))
      .filter((team) => team.points > 0)
      .sort((left, right) => right.points - left.points || left.club.localeCompare(right.club, "uk"));
  };

  return {
    men: buildGenderResults(config.genderMapping.menPrefixes),
    women: buildGenderResults(config.genderMapping.womenPrefixes),
  };
}
