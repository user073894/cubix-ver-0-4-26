import { useCallback, useEffect, useRef, useState } from "react";
import type { Penalty } from "@/lib/stats";

export type TimerPhase = "idle" | "inspecting" | "running" | "stopped";
export type Arm = "none" | "holding" | "ready";

interface Opts {
  inspection: boolean;
  holdToStart: boolean;
  onFinish: (ms: number, penalty: Penalty) => void;
  onStart?: () => void;
}

const HOLD_MS = 300;

export function useTimer(opts: Opts) {
  const o = useRef(opts);
  o.current = opts;
  const [phase, setPhase] = useState<TimerPhase>("idle");
  const [arm, setArm] = useState<Arm>("none");
  const [display, setDisplay] = useState(0); // ms, or inspection seconds remaining
  const phaseRef = useRef<TimerPhase>("idle");
  const armRef = useRef<Arm>("none");
  const startRef = useRef(0);
  const inspectStart = useRef(0);
  const inspectPenalty = useRef<Penalty>("none");
  const holdTimer = useRef<number | null>(null);
  const justStopped = useRef(false);
  const raf = useRef<number | null>(null);

  const setP = (p: TimerPhase) => ((phaseRef.current = p), setPhase(p));
  const setA = (a: Arm) => ((armRef.current = a), setArm(a));

  const loop = useCallback(() => {
    const now = performance.now();
    if (phaseRef.current === "running") setDisplay(now - startRef.current);
    if (phaseRef.current === "inspecting") {
      const el = now - inspectStart.current;
      setDisplay(15000 - el);
      if (el > 17000) {
        setP("stopped");
        setA("none");
        setDisplay(0);
        o.current.onFinish(0, "dnf");
        return;
      }
    }
    raf.current = requestAnimationFrame(loop);
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
    o.current.onFinish(ms, inspectPenalty.current);
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
    if (holdTimer.current) clearTimeout(holdTimer.current);
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
      inspectPenalty.current = "none";
      setP("inspecting");
      startLoop();
      return;
    }
    if (phaseRef.current === "inspecting") {
      const el = now - inspectStart.current;
      inspectPenalty.current = el > 17000 ? "dnf" : el > 15000 ? "+2" : "none";
    } else inspectPenalty.current = "none";
    startRef.current = now;
    setP("running");
    o.current.onStart?.();
    startLoop();
  }, []);

  const reset = useCallback(() => {
    if (raf.current) cancelAnimationFrame(raf.current);
    setP("idle");
    setA("none");
    setDisplay(0);
  }, []);

  useEffect(() => () => void (raf.current && cancelAnimationFrame(raf.current)), []);

  return { phase, arm, display, press, release, stop, reset };
}
