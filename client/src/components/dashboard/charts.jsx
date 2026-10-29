import { useEffect, useMemo, useRef, useState } from "react";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  AreaChart, Area, Legend, Cell, ReferenceLine,
} from "recharts";
import { cn } from "../../lib/utils";
import { ChartCard, ChartBox, CustomTooltip, Delta, num } from "./chartParts";
import { hourSpan, ageLabel, timeline, ZOOM_LEVELS } from "../../lib/format";
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

const TRAFFIC_TABS = [{ key: "hour", label: "By hour" }, { key: "time", label: "Over time" }, { key: "week", label: "Busy times" }];

// One card for visitor traffic: the day per hour (the default, the staffing
// question), a zoomable week / month / year view, and the regular weekly pattern.
//   footfall: {data, description, currentLabel, compareLabel, expectedLabel, nowHour}
//   overTime: {history}   day, today, onPickDay: the dashboard's day
//   weekly:   {matrix, description}
export const TrafficCard = ({ footfall, overTime, weekly, day, today, onPickDay }) => {
  const [tab, setTab] = useState("hour");
  const description = {
    hour: footfall.description,
    time: null,   // the zoom controls take that line
    week: weekly.description,
  }[tab];
  return (
    <ChartCard title="Traffic" description={description} action={<Tabs tabs={TRAFFIC_TABS} value={tab} onChange={setTab} />}>
      {tab === "hour" && <FootfallView {...footfall} />}
      {tab === "time" && <OverTimeView history={overTime.history} day={day} today={today} onPickDay={onPickDay} />}
      {tab === "week" && <BusyTimesView matrix={weekly.matrix} />}
    </ChartCard>
  );
};

// Legend labels in the normal text colour (a faded series' own colour is too pale to read).
const legendText = (value) => <span className="text-muted-foreground">{value}</span>;

// Visitors per hour today (bars) against the same day last week (dashed line).
// Hours still to come show a typical day as faded, outlined bars after "Now".
const FootfallView = ({ data, currentLabel, compareLabel, expectedLabel, nowHour }) => (
  data.length ? (
    <ChartBox>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
          <XAxis dataKey="hour" {...axisProps} tickFormatter={hourLabel} />
          <YAxis {...axisProps} allowDecimals={false} />
          <Tooltip content={<CustomTooltip labelFormatter={hourLabel} />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} formatter={legendText} />
          <Bar dataKey="current" name={currentLabel} stackId="hour" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={32} />
          {data.some((d) => d.expected) && (
            <Bar dataKey="expected" name={expectedLabel} stackId="hour" fill="hsl(var(--primary) / 0.18)"
                 stroke="hsl(var(--primary) / 0.6)" strokeDasharray="4 3" radius={[4, 4, 0, 0]} maxBarSize={32} />
          )}
          {nowHour != null && data.some((d) => d.expected) && (
            <ReferenceLine x={String(nowHour).padStart(2, "0")} stroke="hsl(var(--muted-foreground))" strokeDasharray="2 3"
                           label={{ value: "Now", position: "insideTopRight", fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
          )}
          {compareLabel && (
            <Line dataKey="compare" name={compareLabel} type="monotone" stroke="hsl(var(--muted-foreground))"
                  strokeWidth={2} strokeDasharray="5 4" dot={false} />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </ChartBox>
  ) : <Empty>No visitors in this period yet.</Empty>
);

// ---- Over time: week / month / year as one zoomable bar chart ----
const ZOOM_NAMES = { week: "Week", month: "Month", year: "Year" };
// Full class names so Tailwind keeps them (motion-safe: no animation for reduced motion).
const MOTION = {
  "zoom-in": "motion-safe:animate-zoom-in", "zoom-out": "motion-safe:animate-zoom-out",
  "slide-left": "motion-safe:animate-slide-left", "slide-right": "motion-safe:animate-slide-right",
};
const navButton = "grid h-7 w-7 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent";

const OverTimeView = ({ history, day, today, onPickDay }) => {
  const [level, setLevel] = useState("month");
  const [anchor, setAnchor] = useState(day);
  const [motion, setMotion] = useState(null);   // {anim, origin} for the view that just appeared
  const [viewId, setViewId] = useState(0);      // re-keys the chart so the animation replays
  const box = useRef(null);

  // Picking a day elsewhere (calendar, a week bar) brings the view to it.
  useEffect(() => { setAnchor(day); }, [day]);

  const t = useMemo(() => timeline(history, level, anchor, { today, selected: day }), [history, level, anchor, today, day]);

  const go = (nextLevel, nextAnchor, anim, origin = "50% 100%") => {
    setMotion({ anim, origin }); setLevel(nextLevel); setAnchor(nextAnchor); setViewId((v) => v + 1);
  };
  const zoomTo = (target) => {
    const from = ZOOM_LEVELS.indexOf(level), to = ZOOM_LEVELS.indexOf(target);
    if (to < 0 || to === from) return;
    go(target, anchor, to > from ? "zoom-out" : "zoom-in");
  };
  // +1 zooms out (towards a year), -1 zooms in (towards a week).
  const zoomBy = (step) => zoomTo(ZOOM_LEVELS[ZOOM_LEVELS.indexOf(level) + step]);
  // Clicking a bar zooms into it, growing the new view out of that bar; in the
  // week view it picks that day for the whole dashboard.
  const onBar = (index) => {
    const bar = t.bars[index];
    if (!bar?.zoomTo) return;
    if (level === "week") { onPickDay?.(bar.zoomTo); return; }
    go(level === "year" ? "month" : "week", bar.zoomTo, "zoom-in", `${((index + 0.5) / t.bars.length) * 100}% 100%`);
  };

  // Scroll or pinch over the chart: one gesture moves one level. A trackpad
  // keeps sending scroll events after a flick, so wait for a pause before the
  // next one. On narrow screens plain scrolling stays with the page (pinch still zooms).
  const zoomRef = useRef(zoomBy);
  useEffect(() => { zoomRef.current = zoomBy; });
  useEffect(() => {
    const el = box.current;
    if (!el) return undefined;
    const wide = window.matchMedia("(min-width: 1280px)");
    let acc = 0, locked = false, last = 0;
    const onWheel = (e) => {
      if (!e.ctrlKey && !wide.matches) return;
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      e.preventDefault();
      const now = e.timeStamp;
      if (locked && now - last < 250) { last = now; return; }
      locked = false; last = now;
      acc += e.deltaY;
      if (Math.abs(acc) < (e.ctrlKey ? 6 : 40)) return;
      zoomRef.current(acc > 0 ? 1 : -1);
      acc = 0; locked = true;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const labels = Object.fromEntries(t.bars.map((b) => [b.key, b.label]));
  const tips = Object.fromEntries(t.bars.map((b) => [b.key, b.tooltip]));
  const hasData = t.bars.some((b) => b.count);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <div className="flex items-center gap-1">
          <button className={navButton} onClick={() => t.prev && go(level, t.prev, "slide-right")} disabled={!t.prev}
                  aria-label={`Previous ${ZOOM_NAMES[level].toLowerCase()}`}>
            <FiChevronLeft size={15} />
          </button>
          <span className="min-w-[8.5rem] text-center text-sm font-medium">{t.title}</span>
          <button className={navButton} onClick={() => t.next && go(level, t.next, "slide-left")} disabled={!t.next}
                  aria-label={`Next ${ZOOM_NAMES[level].toLowerCase()}`}>
            <FiChevronRight size={15} />
          </button>
        </div>
        <ZoomSlider level={level} onChange={zoomTo} />
      </div>
      <div ref={box} className="relative mt-1 flex min-h-0 flex-1 flex-col overflow-hidden"
           title={level === "week" ? "Click a day to see it across the dashboard; scroll or pinch to zoom out" : "Click a bar to zoom in; scroll or pinch to zoom"}>
        <div key={viewId} className={cn("flex min-h-0 flex-1 flex-col", motion && MOTION[motion.anim])} style={{ transformOrigin: motion?.origin }}>
          {hasData || level === "week" ? (
            <ChartBox>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={t.bars} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                  <XAxis dataKey="key" {...axisProps} tickFormatter={(k) => labels[k]} interval="preserveStartEnd" minTickGap={14} />
                  <YAxis {...axisProps} allowDecimals={false} tickFormatter={num} />
                  <Tooltip content={<CustomTooltip labelFormatter={(k) => tips[k]} />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }} />
                  {level === "month" && t.avg > 0 && (
                    <ReferenceLine y={t.avg} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4"
                                   label={{ value: `avg ${Math.round(t.avg)}`, position: "insideTopRight", fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  )}
                  <Bar dataKey="count" name="Visitors" fill="hsl(var(--primary) / 0.45)" radius={[4, 4, 0, 0]} maxBarSize={level === "month" ? 28 : 56}
                       onClick={(_, index) => onBar(index)}>
                    {t.bars.map((b) => (
                      <Cell key={b.key} style={{ cursor: b.zoomTo ? "pointer" : "default" }}
                            fill={b.highlight ? "hsl(var(--primary))" : "hsl(var(--primary) / 0.45)"} />
                    ))}
                  </Bar>
                  {level === "week" && (
                    <Line dataKey="compare" name="The week before" type="monotone" stroke="hsl(var(--muted-foreground))"
                          strokeWidth={2} strokeDasharray="5 4" dot={false} />
                  )}
                  {level === "week" && <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} formatter={legendText} />}
                </ComposedChart>
              </ResponsiveContainer>
            </ChartBox>
          ) : <Empty>No visitors in this period.</Empty>}
        </div>
      </div>
    </div>
  );
};

// Three-stop zoom slider: Week, Month, Year (the labels are clickable too).
const ZoomSlider = ({ level, onChange }) => (
  <div className="w-44">
    <input type="range" min={0} max={ZOOM_LEVELS.length - 1} step={1} value={ZOOM_LEVELS.indexOf(level)}
           onChange={(e) => onChange(ZOOM_LEVELS[Number(e.target.value)])}
           aria-label="Zoom" aria-valuetext={ZOOM_NAMES[level]}
           className="h-1.5 w-full cursor-pointer accent-[hsl(var(--primary))]" />
    <div className="-mt-0.5 flex justify-between text-[11px]">
      {ZOOM_LEVELS.map((l) => (
        <button key={l} onClick={() => onChange(l)}
                className={cn("transition-colors hover:text-foreground", l === level ? "font-semibold text-foreground" : "text-muted-foreground")}>
          {ZOOM_NAMES[l]}
        </button>
      ))}
    </div>
  </div>
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
