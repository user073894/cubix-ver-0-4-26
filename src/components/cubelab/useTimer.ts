import { useCallback, useEffect, useRef, useState } from "react";
import { INSPECTION_DNF_MS, inspectionPenalty, type Penalty } from "@/lib/stats";

export type TimerPhase = "idle" | "inspecting" | "running" | "stopped";
export type Arm = "none" | "holding" | "ready";

export interface FinishInfo {
  ms: number; // raw solve time
  penalty: Penalty; // inspection penalty
  inspectionMs: number | null;
}

interface Opts {
  inspection: boolean;
  holdToStart: boolean;
  onFinish: (info: FinishInfo) => void;
  onStart?: () => void;
}

const HOLD_MS = 300;

export function useTimer(opts: Opts) {
  const o = useRef(opts);
  o.current = opts;
  const [phase, setPhase] = useState<TimerPhase>("idle");
  const [arm, setArm] = useState<Arm>("none");
  const [display, setDisplay] = useState(0); // solve ms, or inspection elapsed ms
  const phaseRef = useRef<TimerPhase>("idle");
  const armRef = useRef<Arm>("none");
  const startRef = useRef(0);
  const inspectStart = useRef(0);
  const inspectMs = useRef<number | null>(null);
  const holdTimer = useRef<number | null>(null);
  const justStopped = useRef(false);
  const raf = useRef<number | null>(null);

  const setP = (p: TimerPhase) => ((phaseRef.current = p), setPhase(p));
  const setA = (a: Arm) => ((armRef.current = a), setArm(a));
  const clearHold = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = null;
  };

  const loop = useCallback(() => {
    const now = performance.now();
    if (phaseRef.current === "running") setDisplay(now - startRef.current);
    if (phaseRef.current === "inspecting") {
      const el = now - inspectStart.current;
      setDisplay(el);
      if (el >= INSPECTION_DNF_MS) {
        clearHold();
        setP("stopped");
        setA("none");
        setDisplay(0);
        raf.current = null;
        o.current.onFinish({ ms: 0, penalty: "dnf", inspectionMs: el });
        return;
      }
    }
    if (phaseRef.current === "running" || phaseRef.current === "inspecting") raf.current = requestAnimationFrame(loop);
    else raf.current = null;
  }, []);

  const startLoop = () => {
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(loop);
  };

  const stop = useCallback(() => {
    if (phaseRef.current !== "running") return;
    const ms = performance.now() - startRef.current;
    setP("stopped");
    setDisplay(ms);
    const ins = inspectMs.current;
    o.current.onFinish({ ms, penalty: ins === null ? "none" : inspectionPenalty(ins), inspectionMs: ins });
  }, []);

  const press = useCallback(() => {
    if (phaseRef.current === "running") {
      stop();
      justStopped.current = true;
      return;
    }
    if (armRef.current !== "none") return;
    setA("holding");
    const delay = o.current.holdToStart ? HOLD_MS : 0;
    holdTimer.current = window.setTimeout(() => setA("ready"), delay);
  }, [stop]);

  const release = useCallback(() => {
    clearHold();
    if (justStopped.current) {
      justStopped.current = false;
      return;
    }
    if (armRef.current !== "ready") {
      setA("none");
      return;
    }
    setA("none");
    const now = performance.now();
    if (o.current.inspection && phaseRef.current !== "inspecting") {
      inspectStart.current = now;
      inspectMs.current = null;
      setDisplay(0);
      setP("inspecting");
      startLoop();
      return;
    }
    inspectMs.current = phaseRef.current === "inspecting" ? now - inspectStart.current : null;
    if (inspectMs.current !== null && inspectMs.current >= INSPECTION_DNF_MS) return; // loop records DNF
    startRef.current = now;
    setP("running");
    o.current.onStart?.();
    startLoop();
  }, []);

  /** Cancel any inspection or running solve without recording it. */
  const reset = useCallback(() => {
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = null;
    clearHold();
    justStopped.current = false;
    inspectMs.current = null;
    setP("idle");
    setA("none");
    setDisplay(0);
  }, []);

  useEffect(() => () => void (raf.current && cancelAnimationFrame(raf.current)), []);

  return { phase, arm, display, press, release, stop, reset };
}
