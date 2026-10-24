import path from "path";
import fs from "fs";
import { type AppConfig } from "../config";
import { DIPLOMA_FIELDS } from "../diplomas-config";
import { renderTemplate } from "../render/template-engine";
import { imageToBase64 } from "../utils/image";
import { isAwardPlace, type AwardsModeOptions } from "./awards-mode";

export type DiplomaEntry = {
  participantName: string;
  teamName: string;
  className: string;
  place: string | number;
};

type ParticipantClass = {
  name: string;
  participants: Array<{ name: string; organisation?: string; position: string | number }>;
};

export function participantDiplomaEntries(classes: ParticipantClass[]): DiplomaEntry[] {
  return classes.flatMap((group) => group.participants.map((participant) => ({
    participantName: participant.name,
    teamName: participant.organisation ?? "",
    className: group.name,
    place: participant.position,
  })));
}

type TeamClass = {
  name: string;
  teams: Array<{
    place: string | number;
    teamName: string;
    members: Array<string | { name: string }>;
  }>;
};

export function teamDiplomaEntries(classes: TeamClass[], config: AppConfig): DiplomaEntry[] {
  return classes.flatMap((group) => group.teams.flatMap((team) => {
    const names = config.diplomas.teamMode === "members" && team.members.length > 0
      ? team.members.map((member) => typeof member === "string" ? member : member.name)
      : [""];
    return names.map((participantName) => ({
      participantName,
      teamName: team.teamName,
      className: group.name,
      place: team.place,
    }));
  }));
}

export function buildDiplomasHtml(
  entries: DiplomaEntry[],
  config: AppConfig,
  options: AwardsModeOptions = {},
): string {
  return renderTemplate("diplomas-pdf.njk", {
    diplomas: config.diplomas,
    fontData: config.diplomas.fontFamily.split(",").some((font) => font.trim().toLowerCase() === "shantell sans")
      ? fs.readFileSync(path.resolve(__dirname, "../assets/fonts/ShantellSans.ttf")).toString("base64")
      : undefined,
    fields: DIPLOMA_FIELDS.map((key) => ({ key, ...config.diplomas.fields[key] })),
    entries: entries.filter((entry) => isAwardPlace(entry.place)),
    background: options.includeDiplomaBackground
      ? imageToBase64(path.resolve(__dirname, "../assets/rogaining-diploma-template.png"))
      : undefined,
  });
}
