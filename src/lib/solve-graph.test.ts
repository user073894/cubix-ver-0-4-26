import { describe, expect, it } from "vitest";
import { solveGraphData } from "./solve-graph";
import type { Solve } from "./stats";

const solve = (time: number, penalty: Solve["penalty"] = "none"): Solve =>
  ({ id: String(time), time, penalty, scramble: "R", date: time });

describe("Records graph", () => {
  it("adds the two-second penalty to the plotted time", () => {
    expect(solveGraphData([solve(10000, "+2")])[0]?.time).toBe(12);
  });
  it("shows DNF as a marker rather than a finite solve time", () => {
    const data = solveGraphData([solve(20000, "dnf"), solve(10000)]);
    expect(data[1]?.time).toBeNull();
    expect(data[1]?.dnf).toBe(10);
    expect(data[0]?.dnf).toBeNull();
  });
  it("orders results chronologically and uses the WCA trimmed Ao5", () => {
    const data = solveGraphData([solve(5000), solve(4000), solve(3000), solve(2000), solve(1000)]);
    expect(data.map((row) => row.number)).toEqual([1, 2, 3, 4, 5]);
    expect(data[4]?.ao5).toBe(3);
    expect(data[3]?.ao5).toBeNull();
  });
  it("supports empty and all-DNF histories", () => {
    expect(solveGraphData([])).toEqual([]);
    expect(solveGraphData([solve(1000, "dnf")])[0]?.dnf).toBe(1);
  });
});