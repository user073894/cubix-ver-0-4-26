import { useState } from "react";
import { Copy, RefreshCw, Trash2, WifiOff, Wifi, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { FACES, type Move } from "@/lib/cube/moves";
import { averageOf, bestAverage, bestSingle, formatSolve, formatTime, type Penalty, type Solve } from "@/lib/stats";
import type { OfflineState } from "@/lib/pwa";

export function AppHeader({ offline, onSettings }: { offline: OfflineState; onSettings: () => void }) {
  return (
    <header className="flex items-center justify-between px-5 pt-[max(env(safe-area-inset-top),1rem)] pb-2">
      <h1 className="text-xl font-bold tracking-tight">
        cube<span className="text-muted-foreground">lab</span>
      </h1>
      <div className="flex items-center gap-2">
        <OfflineStatus state={offline} compact />
        <Button variant="ghost" size="icon" aria-label="Settings" onClick={onSettings}>
          <Settings2 className="size-5" />
        </Button>
      </div>
    </header>
  );
}

const OFFLINE_LABEL: Record<OfflineState, string> = {
  ready: "Offline ready",
  installing: "Caching…",
  preview: "Offline in installed app",
  unsupported: "Offline unsupported",
  error: "Offline unavailable",
};

export function OfflineStatus({ state, compact }: { state: OfflineState; compact?: boolean }) {
  const ok = state === "ready";
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">
      {ok ? <Wifi className="size-3.5 text-timer-ready" /> : <WifiOff className="size-3.5" />}
      {compact && !ok && state !== "installing" ? "Online" : OFFLINE_LABEL[state]}
    </span>
  );
}

export function ScrambleDisplay({ scramble, loading, onNew }: { scramble: Move[]; loading: boolean; onNew: () => void }) {
  const text = scramble.join(" ");
  return (
    <div className="flex items-start gap-2 px-4">
      <p className="min-h-[2.75rem] flex-1 text-center font-mono text-[15px] leading-relaxed sm:text-lg">
        {loading ? <span className="text-muted-foreground">Preparing scrambler…</span> : text || <span className="text-muted-foreground">Tap Scramble to start</span>}
      </p>
      <div className="flex flex-col gap-1">
        <Button variant="ghost" size="icon" aria-label="New scramble" disabled={loading} onClick={onNew}>
          <RefreshCw className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Copy scramble"
          disabled={!text}
          onClick={() => navigator.clipboard?.writeText(text).then(() => toast.success("Scramble copied"))}
        >
          <Copy className="size-4" />
        </Button>
      </div>
    </div>
  );
}

export function CubeMovePanel({ onMove, disabled }: { onMove: (m: Move) => void; disabled?: boolean }) {
  return (
    <div className="grid grid-cols-6 gap-1.5 px-4">
      {FACES.map((f) => (
        <div key={f} className="flex flex-col gap-1.5">
          {[f, f + "'", f + "2"].map((m) => (
            <Button key={m} variant="move" className="h-11 px-0 text-base" disabled={disabled} onClick={() => onMove(m)}>
              {m}
            </Button>
          ))}
        </div>
      ))}
    </div>
  );
}

export function StatisticsPanel({ solves, format }: { solves: Solve[]; format: "mm" | "ss" }) {
  const items: [string, number | null][] = [
    ["Last", solves[0] ? (solves[0].penalty === "dnf" ? Infinity : solves[0].time + (solves[0].penalty === "+2" ? 2000 : 0)) : null],
    ["Best", bestSingle(solves)],
    ["Ao5", averageOf(solves, 5)],
    ["Ao12", averageOf(solves, 12)],
    ["Best Ao5", bestAverage(solves, 5)],
    ["Best Ao12", bestAverage(solves, 12)],
  ];
  return (
    <div className="grid grid-cols-3 gap-2">
      {items.map(([k, v]) => (
        <div key={k} className="rounded-2xl bg-surface px-3 py-2.5">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{k}</div>
          <div className="font-mono text-base tabular">{formatTime(v, format)}</div>
        </div>
      ))}
      <div className="col-span-3 text-center text-xs text-muted-foreground">{solves.length} solves</div>
    </div>
  );
}

export function SolveHistory({
  solves,
  format,
  onPenalty,
  onDelete,
}: {
  solves: Solve[];
  format: "mm" | "ss";
  onPenalty: (id: string, p: Penalty) => void;
  onDelete: (id: string) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = solves.find((s) => s.id === openId);
  if (!solves.length) return <p className="py-6 text-center text-sm text-muted-foreground">No solves yet. Press Space or hold the timer to start.</p>;
  return (
    <>
      <ul className="divide-y divide-border overflow-hidden rounded-2xl bg-surface">
        {solves.slice(0, 50).map((s, i) => (
          <li key={s.id}>
            <button className="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-accent" onClick={() => setOpenId(s.id)}>
              <span className="w-8 text-xs text-muted-foreground">{solves.length - i}</span>
              <span className="flex-1 font-mono tabular">{formatSolve(s, format)}</span>
              <span className="text-xs text-muted-foreground">{new Date(s.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
            </button>
          </li>
        ))}
      </ul>
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpenId(null)}>
        <DialogContent>
          {open && (
            <>
              <DialogHeader>
                <DialogTitle className="font-mono text-3xl">{formatSolve(open, format)}</DialogTitle>
              </DialogHeader>
              <p className="text-xs text-muted-foreground">{new Date(open.date).toLocaleString()}</p>
              <p className="rounded-xl bg-surface-raised p-3 font-mono text-sm">{open.scramble || "No scramble recorded"}</p>
              <div className="flex gap-2">
                {(["none", "+2", "dnf"] as Penalty[]).map((p) => (
                  <Button key={p} variant={open.penalty === p ? "pillPrimary" : "pill"} className="flex-1" onClick={() => onPenalty(open.id, p)}>
                    {p === "none" ? "OK" : p.toUpperCase()}
                  </Button>
                ))}
              </div>
              <DialogFooter>
                <Button variant="destructive" onClick={() => (onDelete(open.id), setOpenId(null))}>
                  <Trash2 className="size-4" /> Delete solve
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
