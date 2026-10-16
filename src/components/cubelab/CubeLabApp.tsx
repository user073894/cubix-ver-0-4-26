import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Cube from "cubejs";
import { toast } from "sonner";
import { Crosshair, Grid3x3, Pause, Play, SkipForward, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Cube3D, type Cube3DHandle } from "./Cube3D";
import { AppHeader, CubeMovePanel, ScrambleDisplay, SolveHistory, StatisticsPanel } from "./panels";
import { SettingsMenu } from "./SettingsMenu";
import { useTimer } from "./useTimer";
import { DEFAULT_SETTINGS, loadSettings, loadSolves, saveSettings, saveSolves, type Settings } from "@/lib/storage";
import { formatTime, type Penalty, type Solve } from "@/lib/stats";
import { initSolver, randomScramble, solveState } from "@/lib/cube/solver";
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
  const [solution, setSolution] = useState<{ moves: Move[]; index: number; playing: boolean } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tutorial, setTutorial] = useState(false);
  const [busy, setBusy] = useState(0);
  const cubeRef = useRef<Cube3DHandle>(null);
  const logical = useRef(new Cube());
  const playing = useRef(false);
  const scrambleRef = useRef<Move[]>([]);
  scrambleRef.current = scramble;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const fb = useCallback((freq?: number) => {
    if (settingsRef.current.sound) playClick(freq);
    if (settingsRef.current.haptics) vibrate(8);
  }, []);

  // Load persisted data
  useEffect(() => {
    Promise.all([loadSettings(), loadSolves()]).then(([s, v]) => {
      setSettings(s);
      setSolves(v);
      setLoaded(true);
    });
    registerOffline(setOffline);
    initSolver().then(() => setSolverReady(true)).catch(() => toast.error("Solver failed to load"));
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
    onFinish: (ms, penalty) => {
      fb(900);
      const solve: Solve = { id: crypto.randomUUID(), time: Math.round(ms), penalty, scramble: scrambleRef.current.join(" "), date: Date.now() };
      setSolves((s) => [solve, ...s]);
      if (solverReady) newScramble();
    },
  });
  const timerRef = useRef(timer);
  timerRef.current = timer;

  const apply = useCallback((moves: Move[]) => {
    if (!moves.length) return Promise.resolve();
    logical.current.move(moves.join(" "));
    return cubeRef.current?.enqueue(moves) ?? Promise.resolve();
  }, []);

  const stopPlayback = () => {
    playing.current = false;
    setSolution((s) => (s ? { ...s, playing: false } : s));
  };

  const hardReset = () => {
    stopPlayback();
    cubeRef.current?.reset();
    logical.current = new Cube();
  };

  const onUserMove = useCallback(
    (m: Move) => {
      fb();
      setSolution(null);
      playing.current = false;
      apply([m]);
      if (timerRef.current.phase === "running" && logical.current.isSolved()) timerRef.current.stop();
    },
    [apply, fb],
  );

  async function newScramble() {
    if (!solverReady) return;
    const s = await randomScramble();
    hardReset();
    setSolution(null);
    setScramble(s);
    apply(s);
  }

  // first scramble once ready
  const didFirst = useRef(false);
  useEffect(() => {
    if (solverReady && !splash && !didFirst.current) {
      didFirst.current = true;
      newScramble();
    }
  });

  async function solve() {
    if (!solverReady) return;
    if (logical.current.isSolved()) {
      toast("Cube is already solved");
      return;
    }
    try {
      const moves = await solveState(logical.current.asString());
      setSolution({ moves, index: 0, playing: true });
      play(moves, 0);
    } catch {
      toast.error("This cube state can't be solved");
    }
  }

  async function play(moves: Move[], from: number) {
    playing.current = true;
    for (let i = from; i < moves.length; i++) {
      if (!playing.current) return;
      setSolution({ moves, index: i, playing: true });
      await apply([moves[i]!]);
      setSolution({ moves, index: i + 1, playing: i + 1 < moves.length });
    }
    playing.current = false;
    if (logical.current.isSolved()) toast.success(`Solved in ${moves.length} moves`);
    else toast.error("Solution did not reach the solved state");
  }

  function step() {
    if (!solution || solution.index >= solution.moves.length || playing.current) return;
    const i = solution.index;
    setSolution({ ...solution, index: i + 1 });
    apply([solution.moves[i]!]);
  }

  function reset() {
    hardReset();
    setSolution(null);
    setScramble([]);
    if (timer.phase !== "running") timer.reset();
  }

  // Keyboard timer
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat) return;
      if ((e.target as HTMLElement)?.closest("input,textarea,[role=dialog]")) return;
      e.preventDefault();
      timerRef.current.press();
    };
    const up = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      e.preventDefault();
      timerRef.current.release();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const engineSettings = useMemo(
    () => ({ speed: settings.speed, sensitivity: settings.sensitivity, easy: settings.controls === "easy" }),
    [settings.speed, settings.sensitivity, settings.controls],
  );

  const showPanel = settings.controls === "simple" || settings.showMovePanel;
  const t = timer;
  const timerColor =
    t.arm === "ready" ? "text-timer-ready" : t.arm === "holding" ? "text-timer-hold" : t.phase === "inspecting" ? "text-timer-inspect" : "text-foreground";
  const timerText =
    t.phase === "inspecting"
      ? t.display > 0 ? String(Math.ceil(t.display / 1000)) : t.display > -2000 ? "+2" : "DNF"
      : formatTime(t.display, settings.timeFormat);
  const timerHint =
    t.phase === "running" ? "Tap or press Space to stop" : t.arm === "ready" ? "Release to start" : t.phase === "inspecting" ? "Inspecting — hold to start" : "Hold timer or Space to start";

  return (
    <div className="bg-app min-h-dvh w-full overflow-x-hidden">
      {splash && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
          <span className="text-4xl font-bold tracking-tight">
            cube<span className="text-muted-foreground">lab</span>
          </span>
        </div>
      )}
      <div className="mx-auto flex max-w-xl flex-col lg:max-w-6xl lg:flex-row lg:gap-6">
        <main className="flex flex-col lg:flex-1">
          <AppHeader offline={offline} onSettings={() => setSettingsOpen(true)} />

          <button
            type="button"
            className="mx-auto mt-1 flex touch-none select-none flex-col items-center px-6 py-2 outline-none"
            onPointerDown={(e) => (e.preventDefault(), t.press())}
            onPointerUp={() => t.release()}
            onPointerCancel={() => t.release()}
            onKeyDown={(e) => e.code === "Space" && e.preventDefault()}
            aria-label="Timer"
          >
            <span className={`font-mono text-6xl font-bold tabular tracking-tight transition-colors sm:text-7xl ${timerColor}`}>{timerText}</span>
            <span className="mt-1 text-xs text-muted-foreground">{timerHint}</span>
          </button>

          <div className="mt-3">
            <ScrambleDisplay scramble={scramble} loading={!solverReady} onNew={newScramble} />
          </div>

          <div className="relative mx-auto aspect-square w-full max-w-[min(100vw,560px)]">
            <Cube3D ref={cubeRef} settings={engineSettings} onUserMove={onUserMove} onBusy={setBusy} onReady={() => setSplash(false)} />
            <div className="absolute right-3 bottom-3 flex flex-col gap-2">
              <Button variant="pill" size="icon" aria-label="Recenter view" onClick={() => cubeRef.current?.recenter()}>
                <Crosshair className="size-4" />
              </Button>
              {settings.controls === "easy" && (
                <Button variant={settings.showMovePanel ? "pillPrimary" : "pill"} size="icon" aria-label="Toggle move buttons" onClick={() => update({ showMovePanel: !settings.showMovePanel })}>
                  <Grid3x3 className="size-4" />
                </Button>
              )}
              <Button variant="pill" size="icon" aria-label="Controls tutorial" onClick={() => setTutorial(true)}>
                <HelpCircle className="size-4" />
              </Button>
            </div>
          </div>

          {solution && (
            <div className="mx-4 mb-3 rounded-2xl bg-surface p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">
                  Solution · {solution.index}/{solution.moves.length}
                </span>
                <div className="flex gap-1">
                  {solution.playing ? (
                    <Button variant="ghost" size="icon" aria-label="Pause" onClick={stopPlayback}><Pause className="size-4" /></Button>
                  ) : (
                    solution.index < solution.moves.length && (
                      <>
                        <Button variant="ghost" size="icon" aria-label="Resume" onClick={() => play(solution.moves, solution.index)}><Play className="size-4" /></Button>
                        <Button variant="ghost" size="icon" aria-label="Step" onClick={step}><SkipForward className="size-4" /></Button>
                      </>
                    )
                  )}
                </div>
              </div>
              <p className="font-mono text-sm leading-relaxed">
                {solution.moves.map((m, i) => (
                  <span key={i} className={i < solution.index ? "text-muted-foreground" : i === solution.index ? "text-timer-ready" : ""}>{m} </span>
                ))}
              </p>
            </div>
          )}

          {showPanel && (
            <div className="mb-3">
              <CubeMovePanel onMove={onUserMove} />
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 px-4">
            <Button variant="pillPrimary" className="h-12" disabled={!solverReady} onClick={newScramble}>Scramble</Button>
            <Button variant="pill" className="h-12" disabled={!solverReady || !!solution?.playing} onClick={solve}>Solve</Button>
            <Button variant="pill" className="h-12" onClick={reset}>Reset</Button>
          </div>
          <p className="mt-2 h-4 text-center text-[11px] text-muted-foreground">{busy > 1 ? `Turning… ${busy} moves queued` : ""}</p>
        </main>

        <aside className="flex flex-col gap-4 px-4 pt-4 pb-[max(env(safe-area-inset-bottom),1.5rem)] lg:w-96 lg:pt-16">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Statistics</h2>
          <StatisticsPanel solves={solves} format={settings.timeFormat} />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Recent solves</h2>
          <SolveHistory
            solves={solves}
            format={settings.timeFormat}
            onPenalty={(id, p: Penalty) => setSolves((s) => s.map((x) => (x.id === id ? { ...x, penalty: p } : x)))}
            onDelete={(id) => setSolves((s) => s.filter((x) => x.id !== id))}
          />
        </aside>
      </div>

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
        <DialogContent>
          <DialogHeader><DialogTitle>How to control the cube</DialogTitle></DialogHeader>
          <ul className="space-y-3 text-sm">
            <li><b>Rotate the view:</b> drag on the empty space around the cube. The puzzle never changes.</li>
            <li><b>Turn a face:</b> press on a sticker and swipe along the row or column you want to move. Diagonal swipes are ignored.</li>
            <li><b>Recenter:</b> tap the crosshair button to return to the default angle.</li>
            <li><b>Move buttons:</b> tap the grid button (or pick Simple Controls in settings) for U D L R F B buttons. X = clockwise, X' = counter-clockwise, X2 = half turn.</li>
            <li><b>Timer:</b> hold the timer (or Space) until it turns green, then release. Tap again to stop. Solving the on-screen cube also stops it.</li>
          </ul>
        </DialogContent>
      </Dialog>
    </div>
  );
}
