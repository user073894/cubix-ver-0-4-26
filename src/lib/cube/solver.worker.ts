/// <reference lib="webworker" />
import Cube from "@/vendor/cubejs";

let ready = false;
function ensure() {
  if (!ready) {
    Cube.initSolver();
    ready = true;
  }
}

self.onmessage = (e: MessageEvent<{ id: number; type: string; payload?: string }>) => {
  const { id, type, payload } = e.data;
  try {
    ensure();
    if (type === "init") return self.postMessage({ id, ok: true, result: "" });
    if (type === "scramble") {
      const sol = Cube.random().solve();
      return self.postMessage({ id, ok: true, result: Cube.inverse(sol) });
    }
    if (type === "solve") {
      const c = Cube.fromString(payload!);
      if (c.isSolved()) return self.postMessage({ id, ok: true, result: "" });
      return self.postMessage({ id, ok: true, result: c.solve() });
    }
    throw new Error("unknown request");
  } catch (err) {
    self.postMessage({ id, ok: false, error: String(err) });
  }
};
