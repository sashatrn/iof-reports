import { renderTemplate } from "../render/template-engine";
import { GenderTeamResult } from "../scoring/side-by-side-team";
import { loadConfig } from "../config";
import { formatDate } from "../utils/date";
import { getLeftLogo, getRightLogo } from "./report-logos";
import {
  type AwardsModeOptions,
  filterAwardTop,
  withAwardsSubtitle,
} from "./awards-mode";

type HtmlVariant = "view" | "pdf";

export function buildSideBySideTeamHtml(
  teamResults: {
    men: GenderTeamResult[];
    women: GenderTeamResult[];
  },
  eventDate: Date,
  variant: HtmlVariant = "pdf",
  options: AwardsModeOptions = {},
): string {
  const config = loadConfig();

  return renderTemplate(`side-by-side-team-${variant}.njk`, {
    reportTitle: "Командний протокол",
    event: withAwardsSubtitle({
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
    }, options),
    officials: config.officials,
    men: filterAwardTop(teamResults.men, options),
    women: filterAwardTop(teamResults.women, options),
  });
}
