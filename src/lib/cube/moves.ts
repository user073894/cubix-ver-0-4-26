export type Face = "U" | "D" | "L" | "R" | "F" | "B";
export type Move = string; // "R", "R'", "R2"
export type Axis = 0 | 1 | 2;

export const FACES: Face[] = ["U", "D", "L", "R", "F", "B"];

const FACE_AXIS: Record<Face, { axis: Axis; layer: 1 | -1 }> = {
  R: { axis: 0, layer: 1 },
  L: { axis: 0, layer: -1 },
  U: { axis: 1, layer: 1 },
  D: { axis: 1, layer: -1 },
  F: { axis: 2, layer: 1 },
  B: { axis: 2, layer: -1 },
};

const MOVE_RE = /^[UDLRFB](2|')?$/;

export function isMove(m: string): boolean {
  return MOVE_RE.test(m);
}

export function parseAlg(s: string): Move[] {
  return s
    .trim()
    .split(/\s+/)
    .filter((m) => MOVE_RE.test(m));
}

export function invertMove(m: Move): Move {
  if (m.endsWith("2")) return m;
  if (m.endsWith("'")) return m[0];
  return m + "'";
}

export function invertAlg(moves: Move[]): Move[] {
  return [...moves].reverse().map(invertMove);
}

/** Signed quarter turns about the +axis (right-hand rule, three.js axes: x=R, y=U, z=F). */
export function moveToTurn(m: Move): { axis: Axis; layer: 1 | -1; quarters: number } {
  const { axis, layer } = FACE_AXIS[m[0] as Face];
  const cw = layer === 1 ? -1 : 1; // clockwise when looking at the face
  const quarters = m.endsWith("2") ? 2 * cw : m.endsWith("'") ? -cw : cw;
  return { axis, layer, quarters };
}

/** dir: +1 = positive rotation about +axis. Middle layers are not supported. */
export function turnToMove(axis: Axis, layer: number, dir: 1 | -1): Move | null {
  if (layer !== 1 && layer !== -1) return null;
  const face = (Object.keys(FACE_AXIS) as Face[]).find(
    (f) => FACE_AXIS[f].axis === axis && FACE_AXIS[f].layer === layer,
  )!;
  const cw = layer === 1 ? -1 : 1;
  return dir === cw ? face : face + "'";
}
