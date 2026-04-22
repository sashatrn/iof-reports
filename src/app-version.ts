import fs from "fs";
import path from "path";

export function getAppVersion(): string {
  try {
    const packageJsonPath = path.resolve(__dirname, "..", "package.json");
    const raw = fs.readFileSync(packageJsonPath, "utf-8");
    const parsed = JSON.parse(raw) as { version?: string };
    return parsed.version ?? "unknown";
  } catch {
    return "unknown";
  }
}
