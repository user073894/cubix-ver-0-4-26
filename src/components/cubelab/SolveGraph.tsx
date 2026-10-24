import { useMemo } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis, type TooltipProps } from "recharts";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { solveGraphData } from "@/lib/solve-graph";
import { formatSolve, formatTime, type Solve } from "@/lib/stats";

const config = {
  time: { label: "Time", color: "var(--chart-2)" },
  ao5: { label: "Ao5", color: "var(--chart-4)" },
  dnf: { label: "DNF", color: "var(--destructive)" },
};

function ResultTooltip({ active, payload, format }: TooltipProps<number, string> & { format: "mm" | "ss" }) {
  const row = payload?.[0]?.payload as ReturnType<typeof solveGraphData>[number] | undefined;
  if (!active || !row) return null;
  return (
    <div className="rounded-lg border border-border bg-popover p-3 text-xs text-popover-foreground shadow-md">
      <p className="mb-1 text-muted-foreground">Solve {row.number}</p>
      <p className="font-mono">{formatSolve(row.solve, format)}</p>
      {row.ao5 !== null && <p className="mt-1 font-mono">Ao5 {formatTime(row.ao5 * 1000, format)}</p>}
    </div>
  );
}

export function SolveGraph({ solves, format }: { solves: Solve[]; format: "mm" | "ss" }) {
  const data = useMemo(() => solveGraphData(solves), [solves]);
  return (
    <section aria-label="Solve-time graph" className="min-w-0 border-y border-border py-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Solve times</h2>
        <div className="flex gap-3 text-xs">
          <span className="text-chart-2">Time</span><span className="text-chart-4">Ao5</span>
          {data.some((r) => r.dnf !== null) && <span className="text-destructive">DNF</span>}
        </div>
      </div>
      {!data.length ? <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">No solves yet</div> : (
        <ChartContainer config={config} className="h-56 w-full aspect-auto" aria-label="Solve times in seconds, oldest to newest">
          <LineChart data={data} margin={{ left: 0, right: 12, top: 12, bottom: 0 }} accessibilityLayer>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="number" tickLine={false} axisLine={false} minTickGap={32} />
            <YAxis width={42} tickLine={false} axisLine={false} domain={[0, "auto"]} tickFormatter={(n: number) => `${Number(n.toFixed(1))}s`} />
            <ChartTooltip content={<ResultTooltip format={format} />} />
            <Line dataKey="time" name="Time" type="linear" stroke="var(--color-time)" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 5 }} isAnimationActive={false} connectNulls={false} />
            <Line dataKey="ao5" name="Ao5" type="linear" stroke="var(--color-ao5)" strokeWidth={2} dot={false} isAnimationActive={false} connectNulls={false} />
            <Line dataKey="dnf" name="DNF" stroke="none" dot={{ r: 4, fill: "var(--color-dnf)", stroke: "var(--color-dnf)" }} activeDot={{ r: 5 }} isAnimationActive={false} connectNulls={false} />
          </LineChart>
        </ChartContainer>
      )}
    </section>
  );
}