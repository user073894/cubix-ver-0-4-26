import type { Move } from "@/lib/cube/moves";

const KEY_BASE: Record<string, string> = {
  KeyR: "R", KeyL: "L", KeyU: "U", KeyD: "D", KeyF: "F", KeyB: "B",
  KeyM: "M", KeyE: "E", KeyS: "S",
  KeyX: "x", KeyY: "y", KeyZ: "z",
};
const WIDEABLE = new Set(["R", "L", "U", "D", "F", "B"]);

/**
 * Keyboard → move. Shift = prime, hold 2 = double, hold W = wide.
 * Returns null for keys that aren't cube controls or that include Ctrl/Alt/Meta (browser shortcuts).
 */
export function keyToMove(
  e: { code: string; shiftKey: boolean; ctrlKey: boolean; altKey: boolean; metaKey: boolean },
  held: { wide: boolean; double: boolean },
): Move | null {
  if (e.ctrlKey || e.altKey || e.metaKey) return null;
  const base = KEY_BASE[e.code];
  if (!base) return null;
  const name = held.wide && WIDEABLE.has(base) ? base + "w" : base;
  if (held.double) return name + "2";
  return e.shiftKey ? name + "'" : name;
}

export const KEY_GUIDE: [string, string][] = [
  ["R L U D F B", "Face turns"],
  ["Shift + key", "Prime (counter-clockwise), e.g. Shift+R = R'"],
  ["Hold 2 + key", "Double turn, e.g. 2+R = R2"],
  ["Hold W + key", "Wide turn, e.g. W+R = Rw (Shift for Rw')"],
  ["M E S", "Slice turns (Shift = prime)"],
  ["X Y Z", "Whole-cube rotations x y z (Shift = prime)"],
  ["Space", "Timer: hold, release to start, press to stop"],
  ["?", "Show this guide"],
];
