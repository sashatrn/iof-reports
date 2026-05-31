import { Participant } from "../io/parse-iof";
import { renderTemplate } from "../render/template-engine";
import { formatDate } from "../utils/date";
import { imageToBase64 } from "../utils/image";
import { loadConfig } from "../config";
import path from "path";

type HtmlVariant = "view" | "pdf";

function formatTime(sec?: number) {
  if (!sec) return "";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${h > 0 ? h + ":" : ""}${m
    .toString()
    .padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function buildSideBySideIndividualHtml(
  participants: Participant[],
  eventDate: Date,
  variant: HtmlVariant = "pdf",
): string {
  const byClass = new Map<string, Participant[]>();

  for (const p of participants) {
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
        points: p.points,
      })),
  }));

  const config = loadConfig();
  const logo1Path = path.resolve(__dirname, "../assets/logo1.png");
  const logo2Path = path.resolve(__dirname, "../assets/logo2.png");

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
      logo1: imageToBase64(logo1Path),
      logo2: imageToBase64(logo2Path),
    },
    officials: config.officials,
    classes,
  });
}
