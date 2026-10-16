import { get, set } from "idb-keyval";
import type { Solve } from "./stats";

export interface Settings {
  controls: "easy" | "simple";
  inspection: boolean;
  holdToStart: boolean;
  timeFormat: "mm" | "ss";
  sound: boolean;
  haptics: boolean;
  theme: "dark" | "light";
  sensitivity: number;
  speed: number;
  showMovePanel: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  controls: "easy",
  inspection: false,
  holdToStart: true,
  timeFormat: "mm",
  sound: true,
  haptics: true,
  theme: "dark",
  sensitivity: 1,
  speed: 1,
  showMovePanel: false,
};

export async function loadSettings(): Promise<Settings> {
  try {
    return { ...DEFAULT_SETTINGS, ...((await get("cubelab:settings")) ?? {}) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}
export const saveSettings = (s: Settings) => set("cubelab:settings", s).catch(() => {});

export async function loadSolves(): Promise<Solve[]> {
  try {
    return (await get("cubelab:solves")) ?? [];
  } catch {
    return [];
  }
}
export const saveSolves = (s: Solve[]) => set("cubelab:solves", s).catch(() => {});
