// ---- Date range helpers ----
const fmt = (d) => d.toISOString().slice(0, 10);
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

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
  const start = new Date(from), end = new Date(to);
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
