import { renderTemplate } from "../render/template-engine";
import { SingleReportType } from "../report-types";

type ViewerPageData = {
  title: string;
  sourceFileName: string;
  reportType: SingleReportType;
  updatedAt: string;
};

export function renderViewerPage(data: ViewerPageData): string {
  return renderTemplate("viewer.njk", data);
}
