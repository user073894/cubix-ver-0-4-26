import { describe, expect, it } from "vitest";
import { Euler, Quaternion, Vector3 } from "three";
import { CUBE_ORIENTATIONS, RIGID_VIEW, nearestCubeView, rigidRotationEnabled } from "./rotation";

describe("rigid laptop rotation", () => {
  it("is enabled only for laptop-sized screens with mouse controls", () => {
    expect(rigidRotationEnabled(true, 1366, true, true)).toBe(true);
    expect(rigidRotationEnabled(false, 1366, true, true)).toBe(false);
    expect(rigidRotationEnabled(true, 390, false, false)).toBe(false);
    expect(rigidRotationEnabled(true, 1024, false, false)).toBe(false);
    expect(rigidRotationEnabled(true, 900, true, true)).toBe(false);
  });
  it("snaps to exactly one of the 24 stable views", () => {
    const base = new Quaternion().setFromEuler(new Euler(0.52, -0.68, 0));
    expect(CUBE_ORIENTATIONS).toHaveLength(24);
    for (const orientation of CUBE_ORIENTATIONS) {
      const target = base.clone().multiply(orientation);
      const perturbed = target.clone().multiply(new Quaternion().setFromEuler(new Euler(0.05, -0.04, 0.03)));
      expect(nearestCubeView(perturbed, base).angleTo(target)).toBeLessThan(0.000001);
    }
  });
  it("keeps keyboard axes distinct even at diagonal camera angles", () => {
    const diagonal = new Quaternion().setFromEuler(new Euler(0.8, 0.8, 0.8));
    const inverse = nearestCubeView(diagonal).invert();
    const axes = [new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, 0, 1)]
      .map((v) => v.applyQuaternion(inverse).toArray().map(Math.abs).indexOf(1));
    expect(new Set(axes).size).toBe(3);
  });
  it("settles with only the top and front visible across all 24 orientations", () => {
    const normals = [new Vector3(1, 0, 0), new Vector3(-1, 0, 0), new Vector3(0, 1, 0),
      new Vector3(0, -1, 0), new Vector3(0, 0, 1), new Vector3(0, 0, -1)];
    for (const orientation of CUBE_ORIENTATIONS) {
      const view = RIGID_VIEW.clone().multiply(orientation);
      const visible = normals.map((n) => n.clone().applyQuaternion(view)).filter((n) => n.z > 0.001);
      expect(visible).toHaveLength(2);
      expect(visible.every((n) => Math.abs(n.x) < 0.000001)).toBe(true);
      expect(nearestCubeView(view, RIGID_VIEW).angleTo(view)).toBeLessThan(0.000001);
    }
    expect(new Vector3(0, 1, 0).applyQuaternion(RIGID_VIEW).z).toBeGreaterThan(0);
    expect(new Vector3(0, 0, 1).applyQuaternion(RIGID_VIEW).z).toBeGreaterThan(0);
  });
});