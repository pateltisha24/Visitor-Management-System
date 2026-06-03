import { motion } from "framer-motion";

const bars = [
  { age: "10–20", m: 34, f: 28 },
  { age: "20–30", m: 72, f: 80 },
  { age: "30–50", m: 58, f: 49 },
  { age: "50–60", m: 26, f: 31 },
];

const emotions = [
  { label: "Happy", pct: 42, color: "hsl(var(--chart-3))" },
  { label: "Neutral", pct: 31, color: "hsl(var(--chart-5))" },
  { label: "Surprise", pct: 16, color: "hsl(var(--chart-1))" },
  { label: "Sad", pct: 11, color: "hsl(var(--chart-2))" },
];

export const DashboardPreview = () => {
  const max = Math.max(...bars.flatMap((b) => [b.m, b.f]));
  return (
    <div className="relative">
      <div className="pointer-events-none absolute -inset-6 -z-10 rounded-[2rem] bg-primary/10 blur-2xl" />
      <div className="rounded-2xl border border-border bg-card p-5 shadow-lift">
        {/* window chrome */}
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
            </span>
            <span className="text-xs font-medium text-muted-foreground">Live · Store 01</span>
          </div>
          <span className="font-mono text-[11px] text-muted-foreground">Today</span>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { k: "1,284", l: "Visitors" },
            { k: "63:37", l: "F : M" },
            { k: "20–30", l: "Top age" },
          ].map((kpi) => (
            <div key={kpi.l} className="rounded-xl border border-border bg-background/60 p-3">
              <div className="font-mono text-lg font-semibold leading-none">{kpi.k}</div>
              <div className="mt-1.5 text-[11px] text-muted-foreground">{kpi.l}</div>
            </div>
          ))}
        </div>

        {/* mini bar chart */}
        <div className="mt-4 rounded-xl border border-border bg-background/60 p-4">
          <div className="mb-3 text-[11px] font-medium text-muted-foreground">Visitors by age & gender</div>
          <div className="flex h-28 items-end justify-between gap-3">
            {bars.map((b, i) => (
              <div key={b.age} className="flex flex-1 flex-col items-center gap-1.5">
                <div className="flex h-24 w-full items-end justify-center gap-1">
                  <motion.span
                    initial={{ height: 0 }} animate={{ height: `${(b.m / max) * 100}%` }}
                    transition={{ duration: 0.7, delay: 0.4 + i * 0.08 }}
                    className="w-1/2 rounded-t bg-[hsl(var(--chart-5))]"
                  />
                  <motion.span
                    initial={{ height: 0 }} animate={{ height: `${(b.f / max) * 100}%` }}
                    transition={{ duration: 0.7, delay: 0.45 + i * 0.08 }}
                    className="w-1/2 rounded-t bg-primary"
                  />
                </div>
                <span className="font-mono text-[10px] text-muted-foreground">{b.age}</span>
              </div>
            ))}
          </div>
        </div>

        {/* emotion bars */}
        <div className="mt-4 space-y-2.5">
          {emotions.map((e, i) => (
            <div key={e.label} className="flex items-center gap-3">
              <span className="w-16 text-[11px] text-muted-foreground">{e.label}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                <motion.div
                  initial={{ width: 0 }} animate={{ width: `${e.pct}%` }}
                  transition={{ duration: 0.8, delay: 0.5 + i * 0.1 }}
                  className="h-full rounded-full"
                  style={{ background: e.color }}
                />
              </div>
              <span className="w-9 text-right font-mono text-[11px] text-foreground">{e.pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
