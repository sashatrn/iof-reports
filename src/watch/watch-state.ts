import fs from "fs";

export type WatchState = {
  lastFilePath?: string;
  lastFileHash?: string;
  updatedAt?: string;
};

export function readWatchState(statePath: string): WatchState {
  if (!fs.existsSync(statePath)) {
    return {};
  }

  return JSON.parse(fs.readFileSync(statePath, "utf-8")) as WatchState;
}

export function writeWatchState(statePath: string, state: WatchState): void {
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
}
