import { Matrix4, Quaternion, Vector3 } from "three";

/** The 24 proper cube orientations, never mirrored or duplicate face mappings. */
const directions = [
  new Vector3(1, 0, 0), new Vector3(-1, 0, 0),
  new Vector3(0, 1, 0), new Vector3(0, -1, 0),
  new Vector3(0, 0, 1), new Vector3(0, 0, -1),
];
export const CUBE_ORIENTATIONS = directions.flatMap((x) => directions
  .filter((y) => x.dot(y) === 0)
  .map((y) => new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x, y, new Vector3().crossVectors(x, y)))));

export function nearestCubeView(view: Quaternion, base = new Quaternion()): Quaternion {
  let best = base.clone();
  let score = -1;
  for (const orientation of CUBE_ORIENTATIONS) {
    const candidate = base.clone().multiply(orientation);
    const dot = Math.abs(view.dot(candidate));
    if (dot > score) {
      best = candidate;
      score = dot;
    }
  }
  return best;
}

export function rigidRotationEnabled(enabled: boolean, width: number, finePointer: boolean, hover: boolean) {
  return enabled && width >= 1024 && finePointer && hover;
}