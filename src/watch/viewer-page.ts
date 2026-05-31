import { renderTemplate } from "../render/template-engine";
type ViewerPageData = {
  title: string;
  sourceFileName: string;
  reportType: string;
  updatedAt: string;
};

export function renderViewerPage(data: ViewerPageData): string {
  return renderTemplate("viewer.njk", data);
}
