// ---- Date range helpers ----
// Dates are local calendar days ("YYYY-MM-DD"), matching how the CV pipeline
// writes each reading's Date. (toISOString() would give the UTC day, which in
// the evening west of UTC is already tomorrow.)
const pad2 = (n) => String(n).padStart(2, "0");
export const fmt = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
export const parseDate = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

export const RANGE_PRESETS = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "all", label: "All time" },
];

export function presetRange(preset) {
  const today = new Date();
  if (preset === "today") return { from: fmt(today), to: fmt(today) };
  if (preset === "7d") return { from: fmt(addDays(today, -6)), to: fmt(today) };
  if (preset === "30d") return { from: fmt(addDays(today, -29)), to: fmt(today) };
  return { from: "", to: "" }; // all time
}

// Equal-length window immediately before [from, to].
export function previousRange(from, to) {
  if (!from || !to) return null;
  const start = parseDate(from), end = parseDate(to);
  const len = Math.round((end - start) / 86400000) + 1;
  const prevTo = addDays(start, -1);
  const prevFrom = addDays(prevTo, -(len - 1));
  return { from: fmt(prevFrom), to: fmt(prevTo) };
}

// ---- Percentage-change delta between two numbers ----
export function pctDelta(current, previous) {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 100);
}

// ---- CSV export ----
export function downloadCSV(rows, filename = "facesense-readings.csv") {
  if (!rows?.length) return;
  const cols = ["Date", "Time", "Age", "Gender", "Emotion", "Gi", "Gi_count"];
  const escape = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => escape(r[c])).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ---- Rule-based "auto insights" ----
const POSITIVE = ["Happy", "Surprise"];

export function positivityIndex(emotion = {}) {
  const total = Object.values(emotion).reduce((a, b) => a + b, 0);
  if (!total) return 0;
  const pos = POSITIVE.reduce((a, e) => a + (emotion[e] || 0), 0);
  return Math.round((pos / total) * 100);
}

export function hourTotals(byHour = []) {
  return byHour.map((h) => ({
    hour: h.hour,
    total: Object.entries(h).reduce((a, [k, v]) => (k === "hour" ? a : a + v), 0),
    happy: h.Happy || 0,
  }));
}

const NEGATIVE = ["Sad", "Fear", "Angry", "Disgust"];

function stats(nums) {
  if (!nums.length) return { mean: 0, std: 0 };
  const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
  const variance = nums.reduce((a, b) => a + (b - mean) ** 2, 0) / nums.length;
  return { mean, std: Math.sqrt(variance) };
}

// Flag hours that deviate from the day's own baseline (z-score > 2). Returns
// short warning strings — a lightweight, explainable anomaly detector.
export function detectAnomalies(byHour = []) {
  const out = [];
  if (byHour.length < 4) return out; // not enough signal

  const hours = hourTotals(byHour);
  const totals = hours.map((h) => h.total);
  const { mean: tMean, std: tStd } = stats(totals);

  for (const h of hours) {
    // Flag on a 2-sigma deviation OR a clear doubling (the latter catches spikes
    // in small samples, where a lone outlier's z-score is mathematically capped).
    const zSpike = tStd > 0 && (h.total - tMean) / tStd > 2;
    const doubling = tMean > 0 && h.total >= 2 * tMean && h.total - tMean >= 10;
    if (zSpike || doubling) {
      out.push(`Footfall spiked around ${h.hour}:00 (${h.total} vs. ~${Math.round(tMean)} typical).`);
    }
  }

  // Negative-sentiment share per hour.
  const negShares = byHour.map((h) => {
    const total = Object.entries(h).reduce((a, [k, v]) => (k === "hour" ? a : a + v), 0);
    const neg = NEGATIVE.reduce((a, e) => a + (h[e] || 0), 0);
    return { hour: h.hour, share: total ? neg / total : 0, total };
  });
  const { mean: nMean, std: nStd } = stats(negShares.map((n) => n.share));
  for (const n of negShares) {
    if (n.total < 5) continue; // ignore quiet hours
    const zHigh = nStd > 0 && (n.share - nMean) / nStd > 2;
    const doubling = nMean > 0 && n.share >= 2 * nMean && n.share >= 0.3;
    if (zHigh || doubling) {
      out.push(`Negative sentiment unusually high around ${n.hour}:00 (${Math.round(n.share * 100)}%).`);
    }
  }
  return out;
}

export function buildInsights(summary, prevSummary) {
  if (!summary || !summary.total) return [];
  const out = [];
  const hours = hourTotals(summary.byHour);

  const busiest = hours.reduce((a, b) => (b.total > (a?.total || 0) ? b : a), null);
  if (busiest) out.push(`Busiest around ${busiest.hour}:00 with ${busiest.total} readings.`);

  const happiest = hours.reduce((a, b) => (b.happy > (a?.happy || 0) ? b : a), null);
  if (happiest && happiest.happy) out.push(`Happiest stretch was ${happiest.hour}:00.`);

  const topAge = (summary.age || []).reduce((a, b) => (b.count > (a?.count || 0) ? b : a), null);
  const female = summary.gender?.Female || 0, male = summary.gender?.Male || 0;
  const lean = female === male ? "an even gender split" : `a ${female > male ? "female" : "male"} majority`;
  if (topAge) out.push(`Visitors skew ${topAge.age} with ${lean}.`);

  const pos = positivityIndex(summary.emotion);
  if (prevSummary) {
    const prevPos = positivityIndex(prevSummary.emotion);
    const diff = pos - prevPos;
    out.push(`Positive sentiment at ${pos}% (${diff >= 0 ? "up" : "down"} ${Math.abs(diff)} pts vs. previous period).`);
  } else {
    out.push(`Positive sentiment at ${pos}%.`);
  }

  const g = summary.gi || {};
  const gtotal = (g.individual || 0) + (g.group || 0);
  if (gtotal) {
    const groupPct = Math.round(((g.group || 0) / gtotal) * 100);
    out.push(`${groupPct}% arrived in groups, the rest solo.`);
  }
  return out;
}

// ---- Chart data shaping ----
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Range for the daily-trend chart: a single day gets the last 14 days for context.
export function trendRange(preset, now = new Date()) {
  if (preset === "today") return { from: fmt(addDays(now, -13)), to: fmt(now) };
  return presetRange(preset);
}

// [{date, count}] -> one point per calendar day in [from, to] (gaps become 0).
// Without bounds (all time), spans the first to last day that has data.
export function dailySeries(rows = [], from, to, today = fmt(new Date())) {
  const counts = Object.fromEntries(rows.map((r) => [r.date, r.count]));
  const dates = rows.map((r) => r.date).sort();
  const start = from || dates[0], end = to || dates[dates.length - 1];
  if (!start || !end) return [];
  const out = [];
  for (let d = parseDate(start); fmt(d) <= end; d = addDays(d, 1)) {
    const date = fmt(d);
    out.push({
      date,
      label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      count: counts[date] || 0,
      isToday: date === today,
    });
  }
  return out;
}

// Visitors per hour as an average per day, against a comparison period.
// Only the hours that have data in either series (and those in between).
export function footfallSeries(current = { hours: [], days: 0 }, compare = null) {
  const per = (series) => Object.fromEntries((series?.hours || []).map((h) => [h.hour, h.count / Math.max(1, series.days)]));
  const cur = per(current), cmp = compare ? per(compare) : {};
  const hours = [...new Set([...Object.keys(cur), ...Object.keys(cmp)])].map(Number).sort((a, b) => a - b);
  if (!hours.length) return [];
  const round = (v) => (v == null ? null : Math.round(v * 10) / 10);
  const out = [];
  for (let h = hours[0]; h <= hours[hours.length - 1]; h++) {
    const key = pad2(h);
    out.push({ hour: key, current: round(cur[key] ?? 0), compare: compare ? round(cmp[key] ?? 0) : null });
  }
  return out;
}

// {cells: [{dow, hour, avg}]} -> rows Mon..Sun x the hours that ever have data,
// plus the max (for colour scaling) and the top few busiest slots.
export function weeklyMatrix(cells = [], topN = 3) {
  const hours = [...new Set(cells.map((c) => c.hour))].sort();
  const lookup = Object.fromEntries(cells.map((c) => [`${c.dow}|${c.hour}`, c.avg]));
  const order = [1, 2, 3, 4, 5, 6, 0];   // Monday first
  const rows = order.map((dow) => ({ dow, day: WEEKDAYS[dow], values: hours.map((h) => lookup[`${dow}|${h}`] || 0) }));
  const max = cells.reduce((m, c) => Math.max(m, c.avg), 0);
  const peaks = [...cells].sort((a, b) => b.avg - a.avg).slice(0, topN)
    .map((c) => ({ day: WEEKDAYS[c.dow], hour: c.hour, avg: c.avg }));
  return { hours, rows, max, peaks };
}

// {Happy: 12, ...} -> [{name, value, pct}] sorted largest first.
export function emotionShares(emotion = {}) {
  const total = Object.values(emotion).reduce((a, b) => a + b, 0);
  return Object.entries(emotion)
    .map(([name, value]) => ({ name, value, pct: total ? Math.round((value / total) * 100) : 0 }))
    .sort((a, b) => b.value - a.value);
}
