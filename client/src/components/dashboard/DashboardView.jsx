import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { useState, useEffect, useRef } from "react";
import {
  FiUsers, FiRepeat, FiPieChart, FiTrendingUp,
  FiClock, FiSmile, FiAlertTriangle, FiCpu,
} from "react-icons/fi";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { useAuth } from "../../store/auth";
import { api } from "../../api";
import { emotionColor, GENDER_COLORS, axisProps } from "./theme";
import { ChartCard, ChartBox, CustomTooltip, Delta, num } from "./chartParts";
import { TrafficCard, MoodCard, Tabs } from "./charts";
import { cn } from "../../lib/utils";
import { pctDelta, positivityIndex, hourTotals, buildInsights, emotionShares, hourSpan, ageLabel } from "../../lib/format";

// The written read of the view: plain-language takeaways, plus an on-demand AI
// summary. Both stay mounted, so a generated summary survives switching tabs.
const SUMMARY_TABS = [{ key: "takeaways", label: "Takeaways" }, { key: "ai", label: "AI summary" }];

const SummaryCard = ({ summary, insights }) => {
  const [tab, setTab] = useState("takeaways");
  return (
    <ChartCard title="Summary" action={<Tabs tabs={SUMMARY_TABS} value={tab} onChange={setTab} />}>
      <ul className={cn("min-h-0 flex-1 space-y-1 overflow-y-auto pr-1", tab !== "takeaways" && "hidden")}>
        {insights.length ? insights.map((t, i) => (
          <li key={i} className="flex items-start gap-3 text-sm leading-snug">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            <span className="text-foreground/90">{t}</span>
          </li>
        )) : <li className="text-sm text-muted-foreground">Not enough data for insights yet.</li>}
      </ul>
      <AiSummary summary={summary} className={tab !== "ai" ? "hidden" : ""} />
    </ChartCard>
  );
};

const AiSummary = ({ summary, className = "" }) => {
  const { isOffline } = useAuth();
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState("");
  const [err, setErr] = useState("");

  const generate = async () => {
    setLoading(true); setErr("");
    try {
      const res = await api.post("/api/ai/insights", { summary });
      setText(res.data.insight);
    } catch (e) {
      setErr(e.response?.data?.message || "Couldn't generate a summary.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <div className="min-h-0 flex-1 overflow-y-auto pr-1 text-sm leading-relaxed">
        {isOffline ? (
          <p className="text-muted-foreground">Connect to the server to generate AI summaries.</p>
        ) : err ? (
          <p className="text-muted-foreground">{err}</p>
        ) : text ? (
          <p className="whitespace-pre-wrap text-foreground/90">{text}</p>
        ) : (
          <p className="text-muted-foreground">Click <span className="font-medium">Generate</span> for a written summary of this view (Groq by default, or your own provider).</p>
        )}
      </div>
      <Button size="sm" className="mt-3 self-start" onClick={generate} disabled={loading || isOffline}>
        <FiCpu /> {loading ? "Generating…" : text ? "Generate again" : "Generate"}
      </Button>
    </div>
  );
};

const StatCard = ({ icon: Icon, label, value, sub, delta, deltaUnit }) => (
  <Card className="min-w-0 px-4 py-3">
    <div className="flex items-center justify-between gap-2">
      <span className="truncate text-[11px] font-medium uppercase tracking-widest text-muted-foreground">{label}</span>
      <Icon size={15} className="shrink-0 text-primary" />
    </div>
    <div className="mt-1 flex items-center gap-2">
      <span className="truncate font-mono text-xl font-semibold tracking-tight">{value}</span>
      {delta != null && <Delta value={delta} unit={deltaUnit} />}
    </div>
    {sub && <div className="mt-0.5 truncate text-xs text-muted-foreground" title={sub}>{sub}</div>}
  </Card>
);

// Over several days, show the peak hour as a typical day, like the takeaways do.
const peakSub = (count, days) => (days > 1 ? `about ${num(Math.round(count / days))} visitors a day` : `${num(count)} visitors`);

// Amber "Worth a look" badge for the page header; the details open on click.
export const WorthALook = ({ items }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  if (!items.length) return null;
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-500/15 dark:text-amber-400">
        <FiAlertTriangle size={13} /> {items.length === 1 ? "1 thing worth a look" : `${items.length} things worth a look`}
      </button>
      {open && (
        <Card className="absolute right-0 top-full z-30 mt-2 w-80 max-w-[calc(100vw-2rem)] p-4 shadow-lift">
          <ul className="space-y-2">
            {items.map((a, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-foreground/90">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />{a}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
};

// `trends` (optional) carries the data for the Traffic card's three views:
//   { footfall: {data, description, currentLabel, compareLabel},
//     daily: {data, description}, weekly: {matrix, description} }
// On wide screens everything fits one page: a row of figures, then two rows of cards.
export const DashboardView = ({ summary, prevSummary, recent = [], trends, context = {} }) => {
  const { total = 0, gender = {}, genderAge = [], emotion = {}, gi = {}, byHour = [], ageEmotionMatrix = [] } = summary;

  const female = gender.Female || 0, male = gender.Male || 0;
  const femalePct = total ? Math.round((female / total) * 100) : 0;
  const malePct = total ? Math.round((male / total) * 100) : 0;
  const topAge = (summary.age || []).reduce((a, b) => (b.count > (a?.count || 0) ? b : a), null);

  // Comparison + highlights.
  // Like-for-like when available (a day in progress vs complete days would mislead).
  const totalDelta = context.visitorChange ? context.visitorChange.pct : prevSummary ? pctDelta(total, prevSummary.total) : null;
  const pos = positivityIndex(emotion);
  const posDelta = prevSummary ? pos - positivityIndex(prevSummary.emotion) : null;
  const hours = hourTotals(byHour);
  const busiest = hours.reduce((a, b) => (b.total > (a?.total || 0) ? b : a), null);
  const happiest = hours.reduce((a, b) => (b.happy > (a?.happy || 0) ? b : a), null);
  const returning = summary.returning;
  const insights = buildInsights(summary, prevSummary, { ...context, returning });

  const shares = emotionShares(emotion);

  return (
    <div className="grid gap-4 xl:h-full xl:min-h-[500px] xl:grid-rows-[auto_minmax(0,1.3fr)_minmax(0,1fr)]">
      {/* Key figures */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <StatCard icon={FiUsers} label="Visitors" value={num(total)} delta={totalDelta}
                  sub={`${num(gi.individual || 0)} on their own · ${num(gi.group || 0)} with others`} />
        <StatCard icon={FiRepeat} label="Came back" value={returning == null ? "—" : num(returning)}
                  sub={returning == null ? "same-day returns" : `later the same day · ${total ? Math.round((returning / total) * 100) : 0}% of visitors`} />
        <StatCard icon={FiPieChart} label="Women / men" value={`${femalePct} / ${malePct}%`} sub={`${num(female)} women · ${num(male)} men`} />
        <StatCard icon={FiTrendingUp} label="Top age group" value={topAge ? ageLabel(topAge.age) : "—"} sub={topAge ? `${num(topAge.count)} visitors` : "no data"} />
        <StatCard icon={FiClock} label="Peak hour" value={busiest ? hourSpan(busiest.hour) : "—"} sub={busiest ? peakSub(busiest.total, summary.days) : "no data"} />
        <StatCard icon={FiSmile} label="Looked happy" value={`${pos}%`} delta={posDelta} deltaUnit=" pts" sub="happy or surprised" />
      </div>

      {/* Traffic (the staffing question) + the written summary */}
      <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        {trends && <TrafficCard {...trends} />}
        <SummaryCard summary={summary} insights={insights} />
      </div>

      {/* Who is visiting, how they seemed, and who just came in */}
      <div className="grid min-h-0 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <ChartCard title="Age and gender" description="Visitors in each age group, by gender.">
          <ChartBox>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={genderAge} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} barGap={4}>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                <XAxis dataKey="age" {...axisProps} />
                <YAxis {...axisProps} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }} />
                <Bar dataKey="Female" fill={GENDER_COLORS.Female} radius={[4, 4, 0, 0]} maxBarSize={24} />
                <Bar dataKey="Male" fill={GENDER_COLORS.Male} radius={[4, 4, 0, 0]} maxBarSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </ChartBox>
        </ChartCard>
        <MoodCard shares={shares} moodIndex={pos} moodDelta={posDelta} happiestHour={happiest?.happy ? happiest.hour : null}
                  ageEmotionMatrix={ageEmotionMatrix} byHour={byHour} />
        <ChartCard title="Recent visitors" description="The latest visitors as they arrive.">
          <ul className="-mx-2 max-h-[260px] min-h-0 flex-1 space-y-0.5 overflow-y-auto xl:max-h-none">
            {recent.length ? recent.map((r) => (
              <li key={r._id} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-secondary/60">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: emotionColor(r.Emotion) }} />
                <span className="font-mono text-xs text-muted-foreground">{(r.Time || "").slice(0, 5)}</span>
                <span className="text-sm">{r.Gender}, {r.Age}</span>
                <span className="ml-auto text-xs text-muted-foreground">{r.Emotion}</span>
                {r.Gi === "group" && <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">group</span>}
              </li>
            )) : <li className="px-2 py-2 text-sm text-muted-foreground">No recent visitors.</li>}
          </ul>
        </ChartCard>
      </div>
    </div>
  );
};
