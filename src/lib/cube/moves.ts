export type Move = string; // standard notation: R R' R2 M E S Rw x y z ...
export type Axis = 0 | 1 | 2;

/** Base definition: axis, affected layers, signed quarter turns about +axis for the clockwise move. */
const BASE: Record<string, { axis: Axis; layers: number[]; q: 1 | -1 }> = {
  R: { axis: 0, layers: [1], q: -1 },
  L: { axis: 0, layers: [-1], q: 1 },
  U: { axis: 1, layers: [1], q: -1 },
  D: { axis: 1, layers: [-1], q: 1 },
  F: { axis: 2, layers: [1], q: -1 },
  B: { axis: 2, layers: [-1], q: 1 },
  M: { axis: 0, layers: [0], q: 1 }, // follows L
  E: { axis: 1, layers: [0], q: 1 }, // follows D
  S: { axis: 2, layers: [0], q: -1 }, // follows F
  Rw: { axis: 0, layers: [1, 0], q: -1 },
  Lw: { axis: 0, layers: [-1, 0], q: 1 },
  Uw: { axis: 1, layers: [1, 0], q: -1 },
  Dw: { axis: 1, layers: [-1, 0], q: 1 },
  Fw: { axis: 2, layers: [1, 0], q: -1 },
  Bw: { axis: 2, layers: [-1, 0], q: 1 },
  x: { axis: 0, layers: [-1, 0, 1], q: -1 }, // follows R
  y: { axis: 1, layers: [-1, 0, 1], q: -1 }, // follows U
  z: { axis: 2, layers: [-1, 0, 1], q: -1 }, // follows F
};

const MOVE_RE = /^([RLUDFB]w?|[MES]|[xyz])(2|')?$/;

export function isMove(m: string): boolean {
  return MOVE_RE.test(m);
}

export function parseAlg(s: string): Move[] {
  return s.trim().split(/\s+/).filter(isMove);
}

export function invertMove(m: Move): Move {
  if (m.endsWith("2")) return m;
  if (m.endsWith("'")) return m.slice(0, -1);
  return m + "'";
}

export function invertAlg(moves: Move[]): Move[] {
  return [...moves].reverse().map(invertMove);
}

export interface Turn {
  axis: Axis;
  layers: number[];
  quarters: number; // signed quarter turns about +axis (three.js axes: x=R, y=U, z=F)
}

export function moveToTurn(m: Move): Turn {
  const match = MOVE_RE.exec(m);
  if (!match) throw new Error(`Invalid move: ${m}`);
  const b = BASE[match[1]!]!;
  const quarters = match[2] === "2" ? 2 * b.q : match[2] === "'" ? -b.q : b.q;
  return { axis: b.axis, layers: b.layers, quarters };
}

/** Swipe result → move. dir: +1 = positive rotation about +axis. Single layers only (-1, 0, 1). */
export function turnToMove(axis: Axis, layer: number, dir: 1 | -1): Move | null {
  const name = Object.keys(BASE).find((k) => {
    const b = BASE[k]!;
    return b.axis === axis && b.layers.length === 1 && b.layers[0] === layer;
  });
  if (!name) return null;
  return dir === BASE[name]!.q ? name : name + "'";
}

/** Rotate an integer vector by quarter turns about an axis (right-hand rule). */
export function rotateVec(v: [number, number, number], axis: Axis, quarters: number): [number, number, number] {
  let [x, y, z] = v;
  const n = ((quarters % 4) + 4) % 4;
  for (let i = 0; i < n; i++) {
    if (axis === 0) [y, z] = [-z, y];
    else if (axis === 1) [x, z] = [z, -x];
    else [x, y] = [-y, x];
  }
  return [x, y, z];
}

export type AxisMap = (worldAxis: Axis) => { axis: Axis; sign: 1 | -1 };
const POS = ["R", "U", "F"];
const NEG = ["L", "D", "B"];
const SLICE = ["M", "E", "S"];
const SLICE_NAT = [-1, -1, 1]; // M follows L, E follows D, S follows F
const ROT = ["x", "y", "z"];

/** Re-express a move pressed relative to the screen as the matching move on the cube's actual faces. */
export function remapMove(m: Move, map: AxisMap): Move {
  const match = MOVE_RE.exec(m);
  if (!match) return m;
  const base = match[1]!;
  let suf = match[2] ?? "";
  const flip = () => (suf = suf === "2" ? "2" : suf === "'" ? "" : "'");
  const look = (axis: Axis, sign: number) => {
    const r = map(axis);
    return { axis: r.axis, sign: r.sign * sign };
  };
  const letter = base[0]!;
  const wide = base.endsWith("w") ? "w" : "";
  const pi = POS.indexOf(letter);
  const ni = NEG.indexOf(letter);
  if (pi >= 0 || ni >= 0) {
    const r = look((pi >= 0 ? pi : ni) as Axis, pi >= 0 ? 1 : -1);
    return (r.sign > 0 ? POS[r.axis] : NEG[r.axis]) + wide + suf;
  }
  const si = SLICE.indexOf(letter);
  if (si >= 0) {
    const r = look(si as Axis, SLICE_NAT[si]!);
    if (r.sign !== SLICE_NAT[r.axis]) flip();
    return SLICE[r.axis] + suf;
  }
  const ri = ROT.indexOf(letter);
  const r = look(ri as Axis, 1);
  if (r.sign < 0) flip();
  return ROT[r.axis] + suf;
}
