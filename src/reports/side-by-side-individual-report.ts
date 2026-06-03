import { Participant } from "../io/parse-iof";
import { renderTemplate } from "../render/template-engine";
import { isPdfVisibleParticipant } from "./pdf-status-filter";
import { GenderTeamResult } from "../scoring/side-by-side-team";
import { formatDate } from "../utils/date";
import { loadConfig } from "../config";
import { getLeftLogo, getRightLogo } from "./report-logos";

type HtmlVariant = "view" | "pdf";
type SideBySideTeamResults = {
  men: GenderTeamResult[];
  women: GenderTeamResult[];
};

function formatTime(sec?: number) {
  if (sec === undefined) return "";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${h > 0 ? h + ":" : ""}${m
    .toString()
    .padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function formatTimeBehind(sec?: number) {
  if (sec === undefined || sec === 0) return "";
  const sign = sec < 0 ? "-" : "+";
  const absoluteSeconds = Math.abs(sec);
  const m = Math.floor(absoluteSeconds / 60);
  const s = Math.floor(absoluteSeconds % 60);
  return `${sign}${m}:${s.toString().padStart(2, "0")}`;
}

export function buildSideBySideIndividualHtml(
  participants: Participant[],
  eventDate: Date,
  variant: HtmlVariant = "pdf",
  teamResults?: SideBySideTeamResults,
): string {
  const reportParticipants =
    variant === "pdf" ? participants.filter(isPdfVisibleParticipant) : participants;
  const byClass = new Map<string, Participant[]>();

  for (const p of reportParticipants) {
    if (!byClass.has(p.className)) {
      byClass.set(p.className, []);
    }
    byClass.get(p.className)!.push(p);
  }

  const classes = [...byClass.keys()].sort().map((className) => ({
    name: className,
    participants: byClass
      .get(className)!
      .sort((a, b) => (a.position ?? 999) - (b.position ?? 999))
      .map((p) => ({
        position: p.position ?? "",
        name: p.name,
        club: p.club,
        time: formatTime(p.timeSec),
        timeBehind: formatTimeBehind(p.timeBehindSec),
        points: p.points,
        status: p.status,
      })),
  }));

  const config = loadConfig();

  return renderTemplate(`side-by-side-individual-${variant}.njk`, {
    reportTitle: "Індивідуальний протокол",
    event: {
      title:
        config.reportHeader.title ??
        `Всеукраїнські змагання "Пліч-о-пліч всеукраїнські шкільні ліги зі<br/>
        спортивного орієнтування" серед учнів закладів загальної середньої<br/>
        освіти "РАЗОМ ПЕРЕМОЖЕМО"`,
      subtitle: `ЗАГАЛЬНОКОМАНДНИХ РЕЗУЛЬТАТІВ ЗМАГАНЬ<br/>
        зі спортивного орієнтування ${config.reportHeader.stage} Пліч-о-пліч, Всеукраїнських шкільних ліг<br/>
        ${config.reportHeader.region_of}, ${formatDate(eventDate, "yyyy")} р.`,
      location: config.reportHeader.location,
      date: formatDate(eventDate),
      logo1: getLeftLogo(config, "logo1.png"),
      logo2: getRightLogo(config, "logo2.png"),
    },
    officials: config.officials,
    classes,
    teamResults,
  });
}
