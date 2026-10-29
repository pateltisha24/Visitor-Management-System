import { useState } from "react";
import {
  ResponsiveContainer, ComposedChart, BarChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  AreaChart, Area, Legend, Cell, ReferenceLine,
} from "recharts";
import { cn } from "../../lib/utils";
import { ChartCard, CustomTooltip, Delta } from "./chartParts";
import { hourSpan } from "../../lib/format";
import { emotionColor, axisProps } from "./theme";

const hourLabel = (h) => `${h}:00`;

// Pill-style tab switcher shared by the multi-view cards.
const Tabs = ({ tabs, value, onChange }) => (
  <div className="inline-flex rounded-full border border-border bg-card p-1">
    {tabs.map((t) => (
      <button key={t.key} onClick={() => onChange(t.key)}
              className={cn("rounded-full px-3 py-1 text-xs font-medium transition-colors",
                value === t.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
        {t.label}
      </button>
    ))}
  </div>
);

const TRAFFIC_TABS = [{ key: "hour", label: "By hour" }, { key: "day", label: "By day" }, { key: "week", label: "Busy times" }];

// One card for visitor traffic: per hour (the default, the staffing question),
// per day (the trend), and the regular weekly pattern (weekday x hour).
//   footfall: {data, description, currentLabel, compareLabel}
//   daily:    {data, description}
//   weekly:   {matrix, description}
export const TrafficCard = ({ footfall, daily, weekly }) => {
  const [tab, setTab] = useState("hour");
  const description = { hour: footfall.description, day: daily.description, week: weekly.description }[tab];
  return (
    <ChartCard title="Traffic" description={description} action={<Tabs tabs={TRAFFIC_TABS} value={tab} onChange={setTab} />}>
      {tab === "hour" && <FootfallView {...footfall} />}
      {tab === "day" && <DailyView data={daily.data} />}
      {tab === "week" && <BusyTimesView matrix={weekly.matrix} />}
    </ChartCard>
  );
};

// Visitors per hour (bars) against a comparison period (dashed line).
const FootfallView = ({ data, currentLabel, compareLabel }) => (
  data.length ? (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
        <XAxis dataKey="hour" {...axisProps} tickFormatter={hourLabel} />
        <YAxis {...axisProps} allowDecimals={false} />
        <Tooltip content={<CustomTooltip labelFormatter={hourLabel} />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="current" name={currentLabel} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={32} />
        {compareLabel && (
          <Line dataKey="compare" name={compareLabel} type="monotone" stroke="hsl(var(--muted-foreground))"
                strokeWidth={2} strokeDasharray="5 4" dot={false} />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  ) : <Empty>No visitors in this period yet.</Empty>
);

// Visitors per day, today's bar highlighted, with the period's daily average.
const DailyView = ({ data }) => {
  const days = data.filter((d) => !d.isToday);
  const avg = days.length ? days.reduce((a, d) => a + d.count, 0) / days.length : 0;
  return data.some((d) => d.count) ? (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
        <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={16} />
        <YAxis {...axisProps} allowDecimals={false} />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }} />
        {avg > 0 && (
          <ReferenceLine y={avg} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4"
                         label={{ value: `avg ${Math.round(avg)}`, position: "insideTopRight", fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
        )}
        <Bar dataKey="count" name="Visitors" radius={[4, 4, 0, 0]} maxBarSize={28}>
          {data.map((d) => <Cell key={d.date} fill={d.isToday ? "hsl(var(--primary))" : "hsl(var(--primary) / 0.45)"} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  ) : <Empty>No visitors in this period yet.</Empty>;
};

// Average visitors by weekday x hour: where the regular peaks are.
const BusyTimesView = ({ matrix }) => {
  const { hours, rows, max, peaks } = matrix;
  if (!hours.length) return <Empty>Not enough history yet to show weekly patterns.</Empty>;
  return (
    <>
      <div className="overflow-x-auto">
        <div className="grid min-w-[560px] gap-1" style={{ gridTemplateColumns: `44px repeat(${hours.length}, minmax(0, 1fr))` }}>
          <div />
          {hours.map((h) => <div key={h} className="pb-1 text-center font-mono text-[11px] text-muted-foreground">{h}</div>)}
          {rows.map((r) => (
            <LabeledRow key={r.dow} label={r.day}>
              {r.values.map((v, i) => {
                const intensity = max ? v / max : 0;
                return (
                  <div
                    key={hours[i]}
                    className="h-7 rounded-md"
                    style={{ background: v ? `hsl(var(--primary) / ${0.1 + intensity * 0.85})` : "hsl(var(--muted) / 0.6)" }}
                    title={`${r.day} ${hourSpan(hours[i])} · about ${Math.round(v)} visitors`}
                  />
                );
              })}
            </LabeledRow>
          ))}
        </div>
      </div>
      {peaks.length > 0 && (
        <p className="mt-4 text-sm text-foreground/90">
          Busiest: {peaks.map((p) => `${p.day} ${hourSpan(p.hour)} (about ${Math.round(p.avg)})`).join(" · ")}
        </p>
      )}
    </>
  );
};

const LabeledRow = ({ label, children }) => (
  <>
    <div className="flex items-center font-mono text-xs text-muted-foreground">{label}</div>
    {children}
  </>
);

const MOOD_TABS = [{ key: "overall", label: "Overall" }, { key: "age", label: "By age" }, { key: "hour", label: "By hour" }];
const MATRIX_EMOTIONS = ["Happy", "Neutral", "Surprise", "Sad", "Fear", "Angry", "Disgust"];

// One card for everything mood-related: share of each emotion, emotion by age
// group, and emotion through the day.
export const MoodCard = ({ shares, moodIndex, moodDelta, ageEmotionMatrix, byHour }) => {
  const [tab, setTab] = useState("overall");
  const tabs = <Tabs tabs={MOOD_TABS} value={tab} onChange={setTab} />;
  return (
    <ChartCard title="Mood" description="Estimated from facial expressions — an aggregate signal, not a fact about any one person." action={tabs}>
      {tab === "overall" && <MoodOverall shares={shares} moodIndex={moodIndex} moodDelta={moodDelta} />}
      {tab === "age" && <AgeEmotionGrid matrix={ageEmotionMatrix} />}
      {tab === "hour" && <MoodByHour byHour={byHour} />}
    </ChartCard>
  );
};

const MoodOverall = ({ shares, moodIndex, moodDelta }) => (
  <div>
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Mood index</span>
      <span className="font-mono text-lg font-semibold">{moodIndex}%</span>
      <Delta value={moodDelta} unit=" pts" />
      <span className="text-xs text-muted-foreground">share of happy or surprised faces</span>
    </div>
    <ul className="mt-4 space-y-2.5">
      {shares.map((s) => (
        <li key={s.name} className="grid grid-cols-[72px_1fr_44px] items-center gap-3 text-sm">
          <span className="text-muted-foreground">{s.name}</span>
          <span className="h-2.5 overflow-hidden rounded-full bg-secondary">
            <span className="block h-full rounded-full" style={{ width: `${Math.max(s.pct, s.value ? 1 : 0)}%`, background: emotionColor(s.name) }} />
          </span>
          <span className="text-right font-mono text-xs">{s.pct}%</span>
        </li>
      ))}
    </ul>
  </div>
);

const AgeEmotionGrid = ({ matrix }) => {
  const ages = Array.from(new Set(matrix.map((d) => d.age))).sort();
  const lookup = {};
  let max = 0;
  for (const d of matrix) {
    lookup[`${d.age}|${d.emotion}`] = d.count;
    if (d.count > max) max = d.count;
  }
  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[480px]" style={{ gridTemplateColumns: `78px repeat(${MATRIX_EMOTIONS.length}, 1fr)` }}>
        <div />
        {MATRIX_EMOTIONS.map((e) => <div key={e} className="px-1 pb-2 text-center text-xs font-medium text-muted-foreground">{e}</div>)}
        {ages.map((age) => (
          <LabeledRow key={age} label={age}>
            {MATRIX_EMOTIONS.map((e) => {
              const v = lookup[`${age}|${e}`] || 0;
              const intensity = max ? v / max : 0;
              return (
                <div key={e} className="p-1">
                  <div className="grid h-8 place-items-center rounded-md text-xs font-medium"
                       style={{ background: `hsl(var(--primary) / ${0.08 + intensity * 0.85})`,
                                color: intensity > 0.55 ? "hsl(var(--primary-foreground))" : "hsl(var(--muted-foreground))" }}
                       title={`${age} · ${e}: ${v}`}>
                    {v || ""}
                  </div>
                </div>
              );
            })}
          </LabeledRow>
        ))}
      </div>
    </div>
  );
};

const MoodByHour = ({ byHour }) => {
  const emotions = Array.from(new Set(byHour.flatMap((h) => Object.keys(h).filter((k) => k !== "hour"))));
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={byHour} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <defs>
          {emotions.map((e) => (
            <linearGradient key={e} id={`mood-grad-${e}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={emotionColor(e)} stopOpacity={0.35} />
              <stop offset="100%" stopColor={emotionColor(e)} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
        <XAxis dataKey="hour" {...axisProps} tickFormatter={hourLabel} />
        <YAxis {...axisProps} allowDecimals={false} />
        <Tooltip content={<CustomTooltip labelFormatter={hourLabel} />} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
        {emotions.map((e) => (
          <Area key={e} type="monotone" dataKey={e} stroke={emotionColor(e)} strokeWidth={2} fill={`url(#mood-grad-${e})`} />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
};

const Empty = ({ children }) => (
  <div className="grid h-40 place-items-center rounded-xl bg-secondary/40 text-sm text-muted-foreground">{children}</div>
);
