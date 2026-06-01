import fs from "fs";
import path from "path";

function getImageMimeType(filePath: string): string {
  const ext = path.extname(filePath).slice(1).toLowerCase();

  if (ext === "jpg") {
    return "jpeg";
  }

  if (ext === "svg") {
    return "svg+xml";
  }

  return ext || "png";
}

export function imageToBase64(filePath: string): string {
  const buffer = fs.readFileSync(filePath);
  const mimeType = getImageMimeType(filePath);

  return `data:image/${mimeType};base64,${buffer.toString("base64")}`;
}
