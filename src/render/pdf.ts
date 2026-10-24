import { chromium } from "playwright";

export async function htmlToPdf(html: string, outputPath: string) {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.setContent(html, { waitUntil: "networkidle" });

  await page.pdf({
    path: outputPath,
    format: "A4",
    printBackground: true,
    preferCSSPageSize: true,
  });

  await browser.close();
}
