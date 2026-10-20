import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type { CubeEngine, EngineSettings } from "@/lib/cube/engine";
import type { Move } from "@/lib/cube/moves";

export interface Cube3DHandle {
  enqueue: (m: Move[]) => Promise<void>;
  reset: () => void;
  recenter: () => void;
  viewMove: (m: Move) => Move;
}

interface Props {
  settings: EngineSettings;
  onUserMove: (m: Move) => void;
  onReady: () => void;
  onBusy?: (n: number) => void;
}

export const Cube3D = forwardRef<Cube3DHandle, Props>(function Cube3D(props, ref) {
  const el = useRef<HTMLDivElement>(null);
  const engine = useRef<CubeEngine | null>(null);
  const latest = useRef(props);
  latest.current = props;

  useImperativeHandle(ref, () => ({
    enqueue: (m) => engine.current?.enqueue(m) ?? Promise.resolve(),
    reset: () => engine.current?.reset(),
    recenter: () => engine.current?.recenter(),
    viewMove: (m) => engine.current?.viewMove(m) ?? m,
  }));

  useEffect(() => {
    let cancelled = false;
    import("@/lib/cube/engine").then(({ CubeEngine }) => {
      if (cancelled || !el.current) return;
      engine.current = new CubeEngine(el.current, {
        onUserMove: (m) => latest.current.onUserMove(m),
        onQueueChange: (n) => latest.current.onBusy?.(n),
        getSettings: () => latest.current.settings,
      });
      requestAnimationFrame(() => latest.current.onReady());
    });
    return () => {
      cancelled = true;
      engine.current?.dispose();
      engine.current = null;
    };
  }, []);

  return <div ref={el} className="h-full w-full select-none" aria-label="Interactive 3D Rubik's Cube" />;
});
