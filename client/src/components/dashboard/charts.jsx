import { useState } from "react";
import {
  ResponsiveContainer, ComposedChart, BarChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  AreaChart, Area, Legend, Cell, ReferenceLine,
} from "recharts";
import { cn } from "../../lib/utils";
import { ChartCard, ChartBox, CustomTooltip, Delta, num } from "./chartParts";
import { hourSpan, ageLabel } from "../../lib/format";
import { emotionColor, axisProps } from "./theme";

const hourLabel = (h) => `${h}:00`;

// Pill-style tab switcher shared by the multi-view cards.
export const Tabs = ({ tabs, value, onChange }) => (
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

const TRAFFIC_TABS = [
  { key: "hour", label: "By hour" }, { key: "day", label: "By day" },
  { key: "month", label: "By month" }, { key: "week", label: "Busy times" },
];

// One card for visitor traffic: today per hour (the default, the staffing
// question), the trend per day and per month, and the regular weekly pattern.
//   footfall: {data, description, currentLabel, compareLabel}
//   daily:    {data, description}
//   monthly:  {data, description}
//   weekly:   {matrix, description}
export const TrafficCard = ({ footfall, daily, monthly, weekly }) => {
  const [tab, setTab] = useState("hour");
  const description = { hour: footfall.description, day: daily.description, month: monthly.description, week: weekly.description }[tab];
  return (
    <ChartCard title="Traffic" description={description} action={<Tabs tabs={TRAFFIC_TABS} value={tab} onChange={setTab} />}>
      {tab === "hour" && <FootfallView {...footfall} />}
      {tab === "day" && <DailyView data={daily.data} />}
      {tab === "month" && <MonthlyView data={monthly.data} />}
      {tab === "week" && <BusyTimesView matrix={weekly.matrix} />}
    </ChartCard>
  );
};

// Visitors per hour (bars) against a comparison period (dashed line).
const FootfallView = ({ data, currentLabel, compareLabel }) => (
  data.length ? (
    <ChartBox>
      <ResponsiveContainer width="100%" height="100%">
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
    </ChartBox>
  ) : <Empty>No visitors in this period yet.</Empty>
);

// Visitors per day, today's bar highlighted, with the period's daily average.
const DailyView = ({ data }) => {
  const days = data.filter((d) => !d.isToday);
  const avg = days.length ? days.reduce((a, d) => a + d.count, 0) / days.length : 0;
  return data.some((d) => d.count) ? (
    <ChartBox>
      <ResponsiveContainer width="100%" height="100%">
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
    </ChartBox>
  ) : <Empty>No visitors in this period yet.</Empty>;
};

// Visitors per month, the month in progress highlighted and labelled "so far".
const MonthlyView = ({ data }) => (
  data.length ? (
    <ChartBox>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
          <XAxis dataKey="label" {...axisProps} />
          <YAxis {...axisProps} allowDecimals={false} tickFormatter={num} />
          <Tooltip content={<CustomTooltip labelFormatter={(l) => (l === data[data.length - 1].label ? `${l} (so far)` : l)} />}
                   cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }} />
          <Bar dataKey="count" name="Visitors" radius={[4, 4, 0, 0]} maxBarSize={48}>
            {data.map((d) => <Cell key={d.month} fill={d.isCurrent ? "hsl(var(--primary))" : "hsl(var(--primary) / 0.45)"} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartBox>
  ) : <Empty>No visitors yet.</Empty>
);

// Average visitors by weekday x hour: where the regular peaks are.
const BusyTimesView = ({ matrix }) => {
  const { hours, rows, max, peaks } = matrix;
  if (!hours.length) return <Empty>Not enough history yet to show weekly patterns.</Empty>;
  return (
    <ChartBox className="flex flex-col">
      <div className="min-h-0 flex-1 overflow-x-auto">
        <div className="grid h-full min-w-[560px] gap-1"
             style={{ gridTemplateColumns: `44px repeat(${hours.length}, minmax(0, 1fr))`, gridTemplateRows: `auto repeat(${rows.length}, minmax(10px, 1fr))` }}>
          <div />
          {hours.map((h) => <div key={h} className="pb-1 text-center font-mono text-[11px] text-muted-foreground">{h}</div>)}
          {rows.map((r) => (
            <LabeledRow key={r.dow} label={r.day}>
              {r.values.map((v, i) => {
                const intensity = max ? v / max : 0;
                return (
                  <div
                    key={hours[i]}
                    className="rounded-md"
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
        <p className="mt-2 truncate text-sm text-foreground/90">
          Busiest: {peaks.map((p) => `${p.day} ${hourSpan(p.hour)} (about ${Math.round(p.avg)})`).join(" · ")}
        </p>
      )}
    </ChartBox>
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
export const MoodCard = ({ shares, moodIndex, moodDelta, happiestHour, ageEmotionMatrix, byHour }) => {
  const [tab, setTab] = useState("overall");
  const tabs = <Tabs tabs={MOOD_TABS} value={tab} onChange={setTab} />;
  return (
    <ChartCard title="Mood" description="Estimated from facial expressions, never a fact about one person." action={tabs}>
      {tab === "overall" && <MoodOverall shares={shares} moodIndex={moodIndex} moodDelta={moodDelta} happiestHour={happiestHour} />}
      {tab === "age" && <AgeEmotionGrid matrix={ageEmotionMatrix} />}
      {tab === "hour" && <MoodByHour byHour={byHour} />}
    </ChartCard>
  );
};

const MoodOverall = ({ shares, moodIndex, moodDelta, happiestHour }) => (
  <div className="flex min-h-0 flex-1 flex-col">
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
      <span className="font-mono text-lg font-semibold">{moodIndex}%</span>
      <Delta value={moodDelta} unit=" pts" />
      <span className="text-muted-foreground" title="Share of faces that looked happy or surprised">looked happy</span>
      {happiestHour && <span className="text-muted-foreground">· happiest at {hourSpan(happiestHour)}</span>}
    </div>
    {/* Two columns, read top to bottom, most common first. */}
    <ul className="mt-2 grid min-h-0 flex-1 grid-flow-col grid-cols-2 gap-x-5 gap-y-1 overflow-y-auto"
        style={{ gridTemplateRows: `repeat(${Math.ceil(shares.length / 2)}, minmax(16px, 28px))` }}>
      {shares.map((s) => (
        <li key={s.name} className="grid grid-cols-[56px_1fr_32px] items-center gap-2 text-xs">
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
    <ChartBox className="overflow-x-auto">
      <div className="grid h-full min-w-[420px]"
           style={{ gridTemplateColumns: `64px repeat(${MATRIX_EMOTIONS.length}, 1fr)`, gridTemplateRows: `auto repeat(${ages.length}, minmax(18px, 1fr))` }}>
        <div />
        {MATRIX_EMOTIONS.map((e) => <div key={e} className="truncate px-0.5 pb-1 text-center text-[11px] font-medium text-muted-foreground">{e}</div>)}
        {ages.map((age) => (
          <LabeledRow key={age} label={ageLabel(age)}>
            {MATRIX_EMOTIONS.map((e) => {
              const v = lookup[`${age}|${e}`] || 0;
              const intensity = max ? v / max : 0;
              return (
                <div key={e} className="p-0.5">
                  <div className="grid h-full place-items-center rounded-md text-xs font-medium"
                       style={{ background: `hsl(var(--primary) / ${0.08 + intensity * 0.85})`,
                                color: intensity > 0.55 ? "hsl(var(--primary-foreground))" : "hsl(var(--muted-foreground))" }}
                       title={`${ageLabel(age)} · ${e}: ${v}`}>
                    {v || ""}
                  </div>
                </div>
              );
            })}
          </LabeledRow>
        ))}
      </div>
    </ChartBox>
  );
};

const MoodByHour = ({ byHour }) => {
  const emotions = Array.from(new Set(byHour.flatMap((h) => Object.keys(h).filter((k) => k !== "hour"))));
  return (
    <ChartBox>
      <ResponsiveContainer width="100%" height="100%">
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
    </ChartBox>
  );
};

const Empty = ({ children }) => (
  <div className="grid min-h-[160px] flex-1 place-items-center rounded-xl bg-secondary/40 text-sm text-muted-foreground">{children}</div>
);
