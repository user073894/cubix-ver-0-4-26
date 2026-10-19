import { moveToTurn, rotateVec, type Move } from "./moves";

type V = [number, number, number];
interface Sticker {
  pos: V;
  normal: V;
  color: string;
}

const FACE_NORMALS: [string, V][] = [
  ["U", [0, 1, 0]],
  ["D", [0, -1, 0]],
  ["R", [1, 0, 0]],
  ["L", [-1, 0, 0]],
  ["F", [0, 0, 1]],
  ["B", [0, 0, -1]],
];

/** Logical sticker model shared by every move source (keyboard, swipe, scramble). */
export class CubeState {
  stickers: Sticker[] = [];

  constructor() {
    for (const [color, n] of FACE_NORMALS) {
      const ax = n.findIndex((c) => c !== 0);
      for (let a = -1; a <= 1; a++)
        for (let b = -1; b <= 1; b++) {
          const others = [0, 1, 2].filter((i) => i !== ax);
          const pos: V = [0, 0, 0];
          pos[ax] = n[ax]!;
          pos[others[0]!] = a;
          pos[others[1]!] = b;
          this.stickers.push({ pos, normal: [...n] as V, color });
        }
    }
  }

  move(alg: Move | Move[]) {
    const moves = Array.isArray(alg) ? alg : alg.split(/\s+/).filter(Boolean);
    for (const m of moves) {
      const { axis, layers, quarters } = moveToTurn(m);
      for (const s of this.stickers) {
        if (!layers.includes(s.pos[axis])) continue;
        s.pos = rotateVec(s.pos, axis, quarters);
        s.normal = rotateVec(s.normal, axis, quarters);
      }
    }
    return this;
  }

  /** Color of the sticker at a position facing a direction. */
  colorAt(pos: V, normal: V): string | undefined {
    return this.stickers.find((s) => s.pos.every((c, i) => c === pos[i]) && s.normal.every((c, i) => c === normal[i]))?.color;
  }

  /** Solved in any orientation: every face shows a single color. */
  isSolved(): boolean {
    return FACE_NORMALS.every(([, n]) => {
      const cols = new Set(this.stickers.filter((s) => s.normal.every((c, i) => c === n[i])).map((s) => s.color));
      return cols.size === 1;
    });
  }

  /** Canonical string of the full sticker layout (for comparisons/tests). */
  key(): string {
    return this.stickers
      .map((s) => `${s.pos.join(",")}|${s.normal.join(",")}|${s.color}`)
      .sort()
      .join(";");
  }
}
