import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { Settings } from "@/lib/storage";
import type { OfflineState } from "@/lib/pwa";
import { OfflineStatus } from "./panels";
import type { ReactNode } from "react";

export const APP_VERSION = "0.3.26";

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div>
        <div className="text-sm font-medium">{label}</div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </div>
      {children}
    </div>
  );
}

function Seg<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-full bg-surface-raised p-1">
      {options.map(([v, l]) => (
        <button key={v} onClick={() => onChange(v)} className={`rounded-full px-3 py-1 text-xs ${value === v ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
          {l}
        </button>
      ))}
    </div>
  );
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  settings: Settings;
  update: (p: Partial<Settings>) => void;
  offline: OfflineState;
  onRecenter: () => void;
  onClearHistory: () => void;
  onTutorial: () => void;
}

export function SettingsMenu({ open, onOpenChange, settings: s, update, offline, onRecenter, onClearHistory, onTutorial }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-sm">
        <SheetHeader>
          <SheetTitle>Settings</SheetTitle>
        </SheetHeader>
        <div className="divide-y divide-border px-1">
          <Row label="Controls" hint={s.controls === "easy" ? "Forgiving swipes" : "Shorter, stricter swipes"}>
            <Seg value={s.controls} options={[["easy", "Easy"], ["precise", "Precise"]]} onChange={(v) => update({ controls: v })} />
          </Row>
          <Row label="Timer only" hint="For a real cube: clock only, Space to start/stop">
            <Switch checked={s.timerOnly} onCheckedChange={(v) => update({ timerOnly: v })} />
          </Row>
          <Row label="15s inspection" hint="WCA: +2 from 15s, DNF from 17s">
            <Switch checked={s.inspection} onCheckedChange={(v) => update({ inspection: v })} />
          </Row>
          <Row label="Hold to start" hint="Hold 0.3s until the timer turns green">
            <Switch checked={s.holdToStart} onCheckedChange={(v) => update({ holdToStart: v })} />
          </Row>
          <Row label="Time format">
            <Seg value={s.timeFormat} options={[["mm", "MM:SS.hh"], ["ss", "SS.hh"]]} onChange={(v) => update({ timeFormat: v })} />
          </Row>
          <Row label="Sound effects">
            <Switch checked={s.sound} onCheckedChange={(v) => update({ sound: v })} />
          </Row>
          <Row label="Haptic feedback" hint="On supported phones">
            <Switch checked={s.haptics} onCheckedChange={(v) => update({ haptics: v })} />
          </Row>
          <Row label="Theme">
            <Seg value={s.theme} options={[["dark", "Dark"], ["light", "Light"]]} onChange={(v) => update({ theme: v })} />
          </Row>
          <div className="py-3">
            <div className="mb-3 flex justify-between text-sm"><span className="font-medium">Rotation sensitivity</span><span className="text-muted-foreground">{s.sensitivity.toFixed(1)}×</span></div>
            <Slider min={0.4} max={2} step={0.1} value={[s.sensitivity]} onValueChange={([v]) => update({ sensitivity: v ?? 1 })} />
          </div>
          <div className="py-3">
            <div className="mb-3 flex justify-between text-sm"><span className="font-medium">Animation speed</span><span className="text-muted-foreground">{s.speed.toFixed(1)}×</span></div>
            <Slider min={0.5} max={3} step={0.1} value={[s.speed]} onValueChange={([v]) => update({ speed: v ?? 1 })} />
          </div>
          <div className="flex flex-wrap gap-2 py-4">
            <Button variant="pill" onClick={onRecenter}>Recenter camera</Button>
            <Button variant="pill" onClick={onTutorial}>Controls tutorial</Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="rounded-full">Clear history</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear all solves?</AlertDialogTitle>
                  <AlertDialogDescription>This permanently deletes every recorded solve on this device.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={onClearHistory}>Clear</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
          {void offline}{void OfflineStatus}
          <Row label="Version"><span className="font-mono text-sm text-muted-foreground">cubix {APP_VERSION}</span></Row>
        </div>
      </SheetContent>
    </Sheet>
  );
}
