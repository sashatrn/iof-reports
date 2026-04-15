import { XMLParser } from "fast-xml-parser";
import { parseIsoDate } from "../utils/date";

export type ParsedIof = {
  eventDate?: Date;
  participants: Participant[];
};

export type Participant = {
  className: string;
  name: string;
  club: string;
  timeSec?: number;
  position?: number;
  status: string;
  points: number;
};

export function parseIof(xml: string): ParsedIof {
  const parser = new XMLParser({
    ignoreAttributes: false,
    removeNSPrefix: true,
  });

  const json = parser.parse(xml);

  const eventDate = parseIsoDate(json?.ResultList?.Event?.StartTime?.Date);

  const classResults = json.ResultList.ClassResult;
  const classes = Array.isArray(classResults) ? classResults : [classResults];

  const participants: Participant[] = [];

  for (const cr of classes) {
    const className = cr.Class.Name;
    if (!cr.PersonResult) {
      continue;
    }

    const persons = Array.isArray(cr.PersonResult)
      ? cr.PersonResult
      : [cr.PersonResult];

    for (const pr of persons) {
      const result = pr.Result;

      participants.push({
        className,
        name: `${pr.Person.Name.Given} ${pr.Person.Name.Family}`,
        club: pr.Organisation?.Name ?? "Unknown",
        timeSec: result?.Time ? Number(result.Time) : undefined,
        position: result?.Position ? Number(result.Position) : undefined,
        status: result?.Status ?? "Unknown",
        points: 0,
      });
    }
  }

  return {
    eventDate,
    participants,
  };
}
