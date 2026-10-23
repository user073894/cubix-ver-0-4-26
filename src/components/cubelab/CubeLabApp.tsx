import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Crosshair, HelpCircle, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Cube3D, type Cube3DHandle } from "./Cube3D";
import { AppHeader, ScrambleDisplay, SolveHistory, StatisticsPanel } from "./panels";
import { SettingsMenu } from "./SettingsMenu";
import { useTimer } from "./useTimer";
import { KEY_GUIDE, keyToMove } from "./keyboard";
import { DEFAULT_SETTINGS, loadSettings, loadSolves, saveSettings, saveSolves, type Settings } from "@/lib/storage";
import { INSPECTION_DNF_MS, INSPECTION_PLUS2_MS, formatTime, type Penalty, type Solve } from "@/lib/stats";
import { initSolver, randomScramble } from "@/lib/cube/solver";
import { CubeState } from "@/lib/cube/state";
import type { Move } from "@/lib/cube/moves";
import { playClick, vibrate } from "@/lib/feedback";
import { registerOffline, type OfflineState } from "@/lib/pwa";

export function CubeLabApp() {
  const [splash, setSplash] = useState(true);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [solves, setSolves] = useState<Solve[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [offline, setOffline] = useState<OfflineState>("installing");
  const [solverReady, setSolverReady] = useState(false);
  const [scramble, setScramble] = useState<Move[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [recordsOpen, setRecordsOpen] = useState(false);
  const [tutorial, setTutorial] = useState(false);
  const [lastMove, setLastMove] = useState<Move | null>(null);
  const cubeRef = useRef<Cube3DHandle>(null);
  const mountedAt = useRef(Date.now());
  const onCubeReady = useCallback(() => {
    // Splash stays up for 5 seconds total.
    setTimeout(() => setSplash(false), Math.max(0, 5000 - (Date.now() - mountedAt.current)));
  }, []);
  const logical = useRef(new CubeState());
  const scrambleRef = useRef<Move[]>([]);
  scrambleRef.current = scramble;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const fb = useCallback((freq?: number) => {
    if (settingsRef.current.sound) playClick(freq);
    if (settingsRef.current.haptics) vibrate(8);
  }, []);

  useEffect(() => {
    Promise.all([loadSettings(), loadSolves()]).then(([s, v]) => {
      setSettings(s);
      setSolves(v);
      setLoaded(true);
    });
    registerOffline(setOffline);
    initSolver().then(() => setSolverReady(true)).catch(() => toast.error("Scrambler failed to load"));
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("light", settings.theme === "light");
    if (loaded) saveSettings(settings);
  }, [settings, loaded]);
  useEffect(() => void (loaded && saveSolves(solves)), [solves, loaded]);

  const update = (p: Partial<Settings>) => setSettings((s) => ({ ...s, ...p }));

  const timer = useTimer({
    inspection: settings.inspection,
    holdToStart: settings.holdToStart,
    onStart: () => fb(1200),
    onFinish: ({ ms, penalty, inspectionMs }) => {
      fb(900);
      const solve: Solve = {
        id: crypto.randomUUID(),
        time: Math.round(ms),
        penalty,
        scramble: scrambleRef.current.join(" "),
        date: Date.now(),
        inspection: inspectionMs === null ? null : Math.round(inspectionMs),
        inspectionPenalty: inspectionMs === null ? undefined : penalty,
      };
      setSolves((s) => [solve, ...s]);
      newScrambleRef.current();
    },
  });
  const timerRef = useRef(timer);
  timerRef.current = timer;

  /** Single entry point for every move source: logical state and 3D queue stay in sync. */
  const apply = useCallback((moves: Move[]) => {
    if (!moves.length) return Promise.resolve();
    logical.current.move(moves);
    return cubeRef.current?.enqueue(moves) ?? Promise.resolve();
  }, []);

  const hardReset = () => {
    cubeRef.current?.reset();
    logical.current = new CubeState();
  };

  const onUserMove = useCallback(
    (m: Move) => {
      timerRef.current.startOnMove();
      fb();
      setLastMove(m);
      apply([m]);
      if (timerRef.current.phase === "running" && logical.current.isSolved()) timerRef.current.stop();
    },
    [apply, fb],
  );

  const scrambling = useRef(false);
  async function newScramble() {
    if (!solverReady || scrambling.current) return;
    scrambling.current = true;
    try {
      const s = await randomScramble();
      hardReset();
      setLastMove(null);
      setScramble(s);
      apply(s);
    } finally {
      scrambling.current = false;
    }
  }
  const newScrambleRef = useRef(newScramble);
  newScrambleRef.current = newScramble;

  const didFirst = useRef(false);
  useEffect(() => {
    if (solverReady && !splash && !didFirst.current) {
      didFirst.current = true;
      newScramble();
    }
  });

  function reset() {
    hardReset();
    setScramble([]);
    setLastMove(null);
    timer.reset(); // cancels inspection or an unfinished solve without recording it
  }

  // Keyboard: timer (Space) and cube moves
  useEffect(() => {
    const held = { wide: false, double: false };
    const typing = (t: EventTarget | null) => !!(t as HTMLElement | null)?.closest?.("input,textarea,select,[contenteditable=true],[role=dialog]");
    const down = (e: KeyboardEvent) => {
      if (typing(e.target)) return;
      if (e.code === "KeyW") return (held.wide = true), e.preventDefault();
      if (e.code === "Digit2" || e.code === "Numpad2") return (held.double = true), e.preventDefault();
      if (e.code === "Space") {
        e.preventDefault();
        if (!e.repeat) timerRef.current.press();
        return;
      }
      if (e.key === "?") return e.preventDefault(), setTutorial(true);
      if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"].includes(e.code)) return e.preventDefault();
      if (settingsRef.current.timerOnly) return;
      const m = keyToMove(e, held);
      if (!m) return;
      e.preventDefault();
      if (e.repeat) return;
      onUserMove(cubeRef.current?.viewMove(m) ?? m);
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "KeyW") held.wide = false;
      if (e.code === "Digit2" || e.code === "Numpad2") held.double = false;
      if (e.code === "Space") {
        e.preventDefault();
        timerRef.current.release();
      }
    };
    const blur = () => ((held.wide = false), (held.double = false));
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [onUserMove]);

  const engineSettings = useMemo(
    () => ({ speed: settings.speed, sensitivity: settings.sensitivity, easy: settings.controls === "easy", rigidRotation: settings.rigidRotation }),
    [settings.speed, settings.sensitivity, settings.controls, settings.rigidRotation],
  );

  const t = timer;
  const inspecting = t.phase === "inspecting";
  const el = t.display;
  const timerColor =
    t.arm === "ready"
      ? "text-timer-ready"
      : t.arm === "holding"
        ? "text-timer-hold"
        : inspecting
          ? el >= INSPECTION_PLUS2_MS ? "text-destructive" : el >= 12000 ? "text-timer-hold" : el >= 8000 ? "text-timer-inspect" : "text-foreground"
          : "text-foreground";
  const timerText = inspecting
    ? el < INSPECTION_PLUS2_MS ? String(Math.ceil((INSPECTION_PLUS2_MS - el) / 1000)) : el < INSPECTION_DNF_MS ? "+2" : "DNF"
    : formatTime(t.display, settings.timeFormat);
  const timerHint =
    t.phase === "running"
      ? "Tap or press Space to stop"
      : t.arm === "ready"
        ? "Release to start"
        : inspecting
          ? el >= INSPECTION_PLUS2_MS ? "Start now: +2 penalty" : "Inspecting — hold to start"
          : settings.inspection ? "Hold timer or Space to inspect" : "Hold timer or Space to start";

  return (
    <div className="bg-app fixed inset-0 flex flex-col overflow-hidden overscroll-none">
      {splash && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
          <span className="text-4xl font-bold tracking-tight">
            cub<span className="text-muted-foreground">ix</span>
          </span>
        </div>
      )}
      <div className="mx-auto flex h-full w-full max-w-3xl flex-col lg:max-w-none">
        <AppHeader offline={offline} onSettings={() => setSettingsOpen(true)} />

        <button
          type="button"
          className={`mx-auto flex touch-none ${settings.timerOnly ? "min-h-0 flex-1 w-full justify-center" : "shrink-0"} select-none flex-col items-center px-6 py-1 outline-none`}
          onPointerDown={(e) => (e.preventDefault(), t.press())}
          onPointerUp={() => t.release()}
          onPointerCancel={() => t.release()}
          onKeyDown={(e) => e.code === "Space" && e.preventDefault()}
          aria-label="Timer"
        >
          <span className={`font-mono font-bold tabular tracking-tight transition-colors ${settings.timerOnly ? "text-7xl sm:text-9xl lg:text-[12rem]" : "text-5xl sm:text-6xl"} ${timerColor}`}>{timerText}</span>
          <span className="mt-0.5 text-xs text-muted-foreground">{timerHint}</span>
        </button>

        <div className="mt-1 shrink-0">
          <ScrambleDisplay scramble={scramble} loading={!solverReady} onNew={newScramble} />
        </div>

        <div className={`relative min-h-0 flex-1 items-center justify-center ${settings.timerOnly ? "hidden" : "flex"}`} style={{ containerType: "size" }}>
          <div className="aspect-square" style={{ width: "min(100cqw, 100cqh, 640px)" }}>
            <Cube3D ref={cubeRef} settings={engineSettings} onUserMove={onUserMove} onReady={onCubeReady} />
          </div>
          <span className="pointer-events-none absolute top-1 left-4 font-mono text-xs text-muted-foreground" aria-live="polite">
            {lastMove ?? ""}
          </span>
          <div className="absolute right-3 bottom-2 flex flex-col gap-2">
            <Button variant="pill" size="icon" aria-label="Recenter view" onClick={() => cubeRef.current?.recenter()}>
              <Crosshair className="size-4" />
            </Button>
            <Button variant="pill" size="icon" aria-label="Controls guide" onClick={() => setTutorial(true)}>
              <HelpCircle className="size-4" />
            </Button>
          </div>
        </div>

        <div className="grid shrink-0 grid-cols-3 gap-2 px-4 pt-2 pb-[max(env(safe-area-inset-bottom),0.75rem)] lg:mx-auto lg:w-full lg:max-w-md lg:px-8">
          <Button variant="pillPrimary" className="h-12 lg:h-9" disabled={!solverReady} onClick={newScramble}>Scramble</Button>
          <Button variant="pill" className="h-12 lg:h-9" onClick={() => setRecordsOpen(true)}>
            <BarChart3 className="size-4" /> Records
          </Button>
          <Button variant="pill" className="h-12 lg:h-9" onClick={reset}>{settings.timerOnly ? "Cancel" : "Reset"}</Button>
        </div>
      </div>

      <Sheet open={recordsOpen} onOpenChange={setRecordsOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader><SheetTitle>Records</SheetTitle></SheetHeader>
          <div className="flex flex-col gap-4 px-4 pb-6">
            <StatisticsPanel solves={solves} format={settings.timeFormat} />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Recent solves</h2>
            <SolveHistory
              solves={solves}
              format={settings.timeFormat}
              onPenalty={(id, p: Penalty) => setSolves((s) => s.map((x) => (x.id === id ? { ...x, penalty: p } : x)))}
              onDelete={(id) => setSolves((s) => s.filter((x) => x.id !== id))}
            />
          </div>
        </SheetContent>
      </Sheet>

      <SettingsMenu
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={settings}
        update={update}
        offline={offline}
        onRecenter={() => cubeRef.current?.recenter()}
        onClearHistory={() => (setSolves([]), toast.success("History cleared"))}
        onTutorial={() => (setSettingsOpen(false), setTutorial(true))}
      />

      <Dialog open={tutorial} onOpenChange={setTutorial}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader><DialogTitle>Controls</DialogTitle></DialogHeader>
          <ul className="space-y-2 text-sm">
            <li><b>Touch:</b> swipe a sticker along its row or column to turn that layer (middle rows turn M, E, S). Drag the empty space to look around — that never changes the cube.</li>
            <li><b>Timer:</b> hold the timer until it turns green, release to start, tap to stop. Solving the cube also stops it.</li>
          </ul>
          <h3 className="mt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Keyboard</h3>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
            {KEY_GUIDE.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="font-mono text-foreground">{k}</dt>
                <dd className="text-muted-foreground">{v}</dd>
              </div>
            ))}
          </dl>
        </DialogContent>
      </Dialog>
    </div>
  );
}
