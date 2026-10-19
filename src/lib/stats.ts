export type Penalty = "none" | "+2" | "dnf";

export interface Solve {
  id: string;
  time: number; // raw ms
  penalty: Penalty;
  scramble: string;
  date: number;
  inspection?: number | null; // inspection duration ms (null when inspection was off)
  inspectionPenalty?: Penalty | undefined;
}

export const INSPECTION_PLUS2_MS = 15000;
export const INSPECTION_DNF_MS = 17000;

/** WCA inspection penalty from precise elapsed ms: <15s none, 15s to <17s +2, >=17s DNF. */
export function inspectionPenalty(ms: number): Penalty {
  if (ms >= INSPECTION_DNF_MS) return "dnf";
  if (ms >= INSPECTION_PLUS2_MS) return "+2";
  return "none";
}

/** Effective ms, or Infinity for DNF. */
export function effective(s: Solve): number {
  if (s.penalty === "dnf") return Infinity;
  return s.time + (s.penalty === "+2" ? 2000 : 0);
}

/** WCA-style trimmed average over the most recent n solves (solves newest-first). */
export function averageOf(solves: Solve[], n: number): number | null {
  if (solves.length < n) return null;
  const vals = solves.slice(0, n).map(effective).sort((a, b) => a - b);
  const trim = Math.max(1, Math.ceil(n * 0.05));
  const mid = vals.slice(trim, n - trim);
  if (mid.some((v) => !isFinite(v))) return Infinity;
  return mid.reduce((a, b) => a + b, 0) / mid.length;
}

export function bestSingle(solves: Solve[]): number | null {
  const v = solves.map(effective).filter(isFinite);
  return v.length ? Math.min(...v) : null;
}

export function bestAverage(solves: Solve[], n: number): number | null {
  let best: number | null = null;
  for (let i = 0; i + n <= solves.length; i++) {
    const a = averageOf(solves.slice(i), n);
    if (a !== null && isFinite(a) && (best === null || a < best)) best = a;
  }
  return best;
}

export function formatTime(ms: number | null, format: "mm" | "ss" = "mm"): string {
  if (ms === null) return "—";
  if (!isFinite(ms)) return "DNF";
  const total = Math.floor(ms / 10);
  const hh = total % 100;
  const secs = Math.floor(total / 100);
  const s = secs % 60;
  const m = Math.floor(secs / 60);
  const p2 = (n: number) => String(n).padStart(2, "0");
  if (format === "ss" && m === 0) return `${s}.${p2(hh)}`;
  return `${p2(m)}:${p2(s)}.${p2(hh)}`;
}

export function formatSolve(s: Solve, format: "mm" | "ss" = "mm"): string {
  if (s.penalty === "dnf") return "DNF";
  return formatTime(effective(s), format) + (s.penalty === "+2" ? "+" : "");
}
