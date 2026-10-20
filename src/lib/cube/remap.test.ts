import { describe, expect, it } from "vitest";
import { remapMove, type AxisMap } from "./moves";

const identity: AxisMap = (a) => ({ axis: a, sign: 1 });
// View turned 90° so the viewer's right is the cube's back (+x screen → -z cube).
const turned: AxisMap = (a) => (a === 0 ? { axis: 2, sign: -1 } : a === 2 ? { axis: 0, sign: 1 } : { axis: 1, sign: 1 });

describe("remapMove", () => {
  it("keeps moves when the view is straight on", () => {
    expect(["R", "L'", "Uw2", "M", "x'"].map((m) => remapMove(m, identity))).toEqual(["R", "L'", "Uw2", "M", "x'"]);
  });
  it("R follows the face on the viewer's right", () => {
    expect(remapMove("R", turned)).toBe("B");
    expect(remapMove("L'", turned)).toBe("F'");
    expect(remapMove("F", turned)).toBe("R");
    expect(remapMove("x", turned)).toBe("z'");
    expect(remapMove("M", turned)).toBe("S");
  });
});
