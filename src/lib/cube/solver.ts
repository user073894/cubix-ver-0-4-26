import { parseAlg, type Move } from "./moves";

type Pending = { resolve: (v: string) => void; reject: (e: Error) => void };
let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, Pending>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("./solver.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e) => {
      const p = pending.get(e.data.id);
      if (!p) return;
      pending.delete(e.data.id);
      if (e.data.ok) p.resolve(e.data.result);
      else p.reject(new Error(e.data.error));
    };
  }
  return worker;
}

function call(type: string, payload?: string): Promise<string> {
  const id = ++seq;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ id, type, payload });
  });
}

export const initSolver = () => call("init").then(() => undefined);
export const randomScramble = async (): Promise<Move[]> => parseAlg(await call("scramble"));
export const solveState = async (facelets: string): Promise<Move[]> =>
  parseAlg(await call("solve", facelets));
