// ---- Date range helpers ----
// Dates are local calendar days ("YYYY-MM-DD"), matching how the CV pipeline
// writes each reading's Date. (toISOString() would give the UTC day, which in
// the evening west of UTC is already tomorrow.)
const pad2 = (n) => String(n).padStart(2, "0");
export const fmt = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
export const parseDate = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

// The last n days up to and including `now`, e.g. lastDays(30) for the daily chart.
export const lastDays = (n, now = new Date()) => ({ from: fmt(addDays(now, -(n - 1))), to: fmt(now) });

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

// ---- Plain-language wording (takeaways, anomalies) ----
// Written for a shop owner, not an analyst: no chart words ("readings",
// "sentiment", "skew"), clock times like "12–1 pm", and a suggestion where
// there's an obvious one.

const ampm = (h) => (h % 24 < 12 ? "am" : "pm");
const clock = (h) => { const n = h % 12; return n === 0 ? 12 : n; };
// "12" -> "12–1 pm", "11" -> "11 am–12 pm", "09" -> "9–10 am"
export function hourSpan(hour) {
  const h = Number(hour), next = h + 1;
  return ampm(h) === ampm(next)
    ? `${clock(h)}–${clock(next)} ${ampm(next)}`
    : `${clock(h)} ${ampm(h)}–${clock(next)} ${ampm(next)}`;
}

// "(20-30)" -> "20–30", "(0-10)" -> "under 10", "(60-80)" -> "over 60"
export function ageLabel(bucket = "") {
  const [lo, hi] = bucket.replace(/[()]/g, "").split("-").map(Number);
  if (lo === 0) return `under ${hi}`;
  if (hi >= 80) return `over ${lo}`;
  return `${lo}–${hi}`;
}

// "Female", "(60-80)" -> "Woman, over 60"; under 20s are a girl or a boy.
export function personLabel(gender, age = "") {
  const young = Number(age.replace(/[()]/g, "").split("-")[0]) < 20;
  const word = { Female: young ? "Girl" : "Woman", Male: young ? "Boy" : "Man" }[gender] || gender || "Person";
  return age ? `${word}, ${ageLabel(age)}` : word;
}

const about = (n) => (n >= 10 ? Math.round(n) : Math.round(n * 10) / 10);

// Flag hours that deviate from the day's own baseline (z-score > 2). Returns
// short plain-language warnings — a lightweight, explainable anomaly detector.
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
      out.push(`Unusually busy at ${hourSpan(h.hour)}: ${h.total} visitors, against about ${Math.round(tMean)} in a typical hour. Check you had enough staff on.`);
    }
  }

  // Share of unhappy-looking faces per hour.
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
      out.push(`More people than usual looked unhappy at ${hourSpan(n.hour)} (${Math.round(n.share * 100)}%). Worth checking what happened then, e.g. queues or waiting times.`);
    }
  }
  return out;
}

// Like-for-like visitor change against the same weekday a week earlier, so a
// day still in progress isn't compared with a complete one: only the hours up
// to `nowHour` count (pass 23 for a past day). Returns {pct, label} or null.
export function visitorChange({ summary, hourlyCmp, label, nowHour = new Date().getHours() }) {
  if (!hourlyCmp) return null;
  const baseline = (hourlyCmp.hours || []).filter((h) => Number(h.hour) <= nowHour).reduce((a, h) => a + h.count, 0);
  if (!baseline) return null;
  const current = summary?.total || 0;
  return { pct: Math.round(((current - baseline) / baseline) * 100), label };
}

// Plain-language takeaways for the current view.
//   context.compareLabel:  what prevSummary covers, e.g. "yesterday"
//   context.visitorChange: like-for-like change from visitorChange() (optional)
//   context.returning:     people who came back later the same day (optional)
export function buildInsights(summary, prevSummary, context = {}) {
  if (!summary || !summary.total) return [];
  const out = [];
  const days = Math.max(1, summary.days || 1);
  const perDay = days > 1 ? " a day" : "";
  const hours = hourTotals(summary.byHour).filter((h) => h.total > 0);
  const compare = context.compareLabel || "the previous period";

  // When: busiest and quietest times.
  const sorted = [...hours].sort((a, b) => b.total - a.total);
  if (sorted.length) {
    const top = sorted[0];
    out.push(`Your busiest time was ${hourSpan(top.hour)}, with about ${about(top.total / days)} visitors${perDay}. Make sure you have enough staff on then.`);
  }
  // Quietest *open* hour: ignore hours with under 10% of the peak (stray
  // detections before opening or after closing, e.g. cleaning staff).
  const open = sorted.filter((h) => h.total >= sorted[0]?.total * 0.1);
  if (open.length >= 4) {
    const low = open[open.length - 1];
    out.push(`It was quietest at ${hourSpan(low.hour)} (about ${about(low.total / days)}${perDay}), a good time for restocking or breaks.`);
  }

  // How many, compared with before (like-for-like when available).
  const vc = context.visitorChange;
  if (vc) {
    out.push(vc.pct === 0
      ? `You had about the same number of visitors as ${vc.label}.`
      : `You had ${Math.abs(vc.pct)}% ${vc.pct > 0 ? "more" : "fewer"} visitors than ${vc.label}.`);
  } else if (prevSummary?.total) {
    const change = Math.round(((summary.total - prevSummary.total) / prevSummary.total) * 100);
    out.push(change === 0
      ? `You had the same number of visitors as ${compare}.`
      : `You had ${Math.abs(change)}% ${change > 0 ? "more" : "fewer"} visitors than ${compare}.`);
  }

  // Who.
  const topAge = (summary.age || []).reduce((a, b) => (b.count > (a?.count || 0) ? b : a), null);
  const female = summary.gender?.Female || 0, male = summary.gender?.Male || 0;
  const gap = Math.abs(female - male) / Math.max(1, female + male) * 100;
  const more = female > male ? "women than men" : "men than women";
  const genderText = gap < 4 ? "about as many women as men came in"
    : gap < 15 ? `slightly more ${more} came in` : `many more ${more} came in`;
  if (topAge) out.push(`Most visitors were aged ${ageLabel(topAge.age)}, and ${genderText}.`);

  // How they seemed.
  const pos = positivityIndex(summary.emotion);
  if (prevSummary?.total) {
    const diff = pos - positivityIndex(prevSummary.emotion);
    const trend = Math.abs(diff) < 3 ? `about the same as ${compare}` : `${diff > 0 ? "better" : "worse"} than ${compare}`;
    out.push(`${pos}% of people looked happy, ${trend}.`);
  } else {
    out.push(`${pos}% of people looked happy.`);
  }

  // Together or alone.
  const g = summary.gi || {};
  const gtotal = (g.individual || 0) + (g.group || 0);
  if (gtotal) {
    const groupPct = Math.round(((g.group || 0) / gtotal) * 100);
    out.push(groupPct >= 40
      ? `Lots of people came with others (${groupPct}%); room for groups to browse together helps.`
      : `Most people came on their own; ${groupPct}% came with others.`);
  }

  // Loyalty signal (same-day returns only).
  if (context.returning) {
    out.push(`${context.returning} ${context.returning === 1 ? "person" : "people"} came back later the same day.`);
  }
  return out;
}

// ---- Chart data shaping ----
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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

// [{month: "YYYY-MM", count}] -> one bar per month over the n months up to
// `now`'s, starting at the first month with visitors (gaps after that become 0).
// `now`'s month is marked, and `inProgress` if it's the real current month.
export function monthlySeries(rows = [], n = 12, now = new Date()) {
  const counts = Object.fromEntries(rows.map((r) => [r.month, r.count]));
  const days = Object.fromEntries(rows.map((r) => [r.month, r.days]));
  const months = [];
  for (let i = n - 1; i >= 0; i--) months.push(new Date(now.getFullYear(), now.getMonth() - i, 1));
  const first = months.findIndex((d) => counts[fmt(d).slice(0, 7)]);
  if (first < 0) return [];
  return months.slice(first).map((d, i, shown) => {
    const month = fmt(d).slice(0, 7);
    // The year only where it changes (and on the first bar).
    const withYear = i === 0 || d.getMonth() === 0;
    return {
      month,
      label: d.toLocaleDateString(undefined, withYear ? { month: "short", year: "numeric" } : { month: "short" }),
      count: counts[month] || 0,
      days: days[month] || 0,
      isCurrent: i === shown.length - 1,
      inProgress: month === fmt(new Date()).slice(0, 7),
    };
  });
}

// Visitors per hour as an average per day, against a comparison period.
// Only the hours that have data in either series (and those in between).
// With `expected` ({hour: visitors on a typical day}) and `nowHour`, the hours
// still to come today show what's expected instead of an empty gap.
export function footfallSeries(current = { hours: [], days: 0 }, compare = null, { expected = null, nowHour = null } = {}) {
  const per = (series) => Object.fromEntries((series?.hours || []).map((h) => [h.hour, h.count / Math.max(1, series.days)]));
  const cur = per(current), cmp = compare ? per(compare) : {};
  const exp = expected && nowHour != null
    ? Object.fromEntries(Object.entries(expected).filter(([h]) => Number(h) > nowHour)) : {};
  const hours = [...new Set([...Object.keys(cur), ...Object.keys(cmp), ...Object.keys(exp)])].map(Number).sort((a, b) => a - b);
  if (!hours.length) return [];
  const round = (v) => (v == null ? null : Math.round(v * 10) / 10);
  const out = [];
  for (let h = hours[0]; h <= hours[hours.length - 1]; h++) {
    const key = pad2(h);
    const future = nowHour != null && h > nowHour;
    out.push({
      hour: key,
      current: future ? null : round(cur[key] ?? 0),
      compare: compare ? round(cmp[key] ?? 0) : null,
      ...(expected ? { expected: future ? Math.round(exp[key] ?? 0) : null } : {}),
    });
  }
  return out;
}

// Typical visitors per hour on a given weekday, from the busy-times cells.
export function typicalDay(cells = [], dow) {
  return Object.fromEntries(cells.filter((c) => c.dow === dow).map((c) => [c.hour, c.avg]));
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
