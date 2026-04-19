import fs from "fs";
import path from "path";

export type LatestXmlFile = {
  path: string;
  name: string;
  mtimeMs: number;
  size: number;
};

export function findLatestXml(inputDir: string): LatestXmlFile | undefined {
  const entries = fs
    .readdirSync(inputDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".xml"))
    .map((entry) => {
      const filePath = path.join(inputDir, entry.name);
      const stat = fs.statSync(filePath);

      return {
        path: filePath,
        name: entry.name,
        mtimeMs: stat.mtimeMs,
        size: stat.size,
      };
    })
    .sort((left, right) => {
      if (left.mtimeMs !== right.mtimeMs) {
        return right.mtimeMs - left.mtimeMs;
      }

      return right.name.localeCompare(left.name, "uk");
    });

  return entries[0];
}
