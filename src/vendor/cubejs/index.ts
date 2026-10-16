// Vendored cubejs (MIT, Kociemba two-phase) adapted to run as plain browser/worker scripts.
import "./cube.js";
import "./solve.js";
import type CubeType from "cubejs";
export default (globalThis as unknown as { Cube: typeof CubeType }).Cube;
