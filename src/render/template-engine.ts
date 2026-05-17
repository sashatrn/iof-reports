import nunjucks from "nunjucks";
import path from "path";
import { formatResultStatus } from "../utils/result-status";

let configured = false;
let environment: nunjucks.Environment | undefined;

function ensureConfigured() {
  if (configured) return;

  environment = nunjucks.configure(path.resolve(__dirname, "../templates"), {
    autoescape: false,
    trimBlocks: true,
    lstripBlocks: true,
  });
  environment.addFilter("statusLabel", formatResultStatus);

  configured = true;
}

export function renderTemplate(
  templateName: string,
  data: Record<string, unknown>,
): string {
  ensureConfigured();
  return environment?.render(templateName, data) ?? nunjucks.render(templateName, data);
}
