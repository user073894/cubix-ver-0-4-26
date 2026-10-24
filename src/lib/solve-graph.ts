import { averageOf, effective, type Solve } from "./stats";

/** Display the last 100 results oldest-first; averages still use full preceding history. */
export function solveGraphData(solves: Solve[]) {
  const rows = solves.slice(0, 100).map((solve, i) => {
    const time = effective(solve);
    const ao5 = averageOf(solves.slice(i), 5);
    return {
      number: solves.length - i,
      solve,
      time: Number.isFinite(time) ? time / 1000 : null,
      ao5: ao5 !== null && Number.isFinite(ao5) ? ao5 / 1000 : null,
    };
  }).reverse();
  const ceiling = Math.max(1, ...rows.flatMap((r) => [r.time ?? 0, r.ao5 ?? 0]));
  return rows.map((row) => ({ ...row, dnf: row.solve.penalty === "dnf" ? ceiling : null }));
}