import nunjucks from "nunjucks";
import path from "path";

let configured = false;

function ensureConfigured() {
  if (configured) return;

  nunjucks.configure(path.resolve(__dirname, "../templates"), {
    autoescape: false,
    trimBlocks: true,
    lstripBlocks: true,
  });

  configured = true;
}

export function renderTemplate(
  templateName: string,
  data: Record<string, unknown>,
): string {
  ensureConfigured();
  return nunjucks.render(templateName, data);
}
