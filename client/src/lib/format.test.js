import { describe, it, expect } from "vitest";
import {
  presetRange, previousRange, pctDelta, positivityIndex, hourTotals,
  buildInsights, detectAnomalies, fmt, parseDate, trendRange, dailySeries,
  footfallSeries, weeklyMatrix, emotionShares,
} from "./format";

describe("pctDelta", () => {
  it("computes percentage change", () => {
    expect(pctDelta(120, 100)).toBe(20);
    expect(pctDelta(80, 100)).toBe(-20);
  });
  it("returns null when previous is zero/missing", () => {
    expect(pctDelta(100, 0)).toBeNull();
  });
});

describe("previousRange", () => {
  it("returns the equal-length window immediately before", () => {
    // 7-day window
    const prev = previousRange("2026-06-01", "2026-06-07");
    expect(prev).toEqual({ from: "2026-05-25", to: "2026-05-31" });
  });
  it("returns null without both bounds", () => {
    expect(previousRange("", "")).toBeNull();
  });
});

describe("presetRange", () => {
  it("today is a single day", () => {
    const r = presetRange("today");
    expect(r.from).toBe(r.to);
  });
  it("all time has empty bounds", () => {
    expect(presetRange("all")).toEqual({ from: "", to: "" });
  });
});

describe("positivityIndex", () => {
  it("is the share of positive emotions", () => {
    expect(positivityIndex({ Happy: 50, Surprise: 50, Sad: 100 })).toBe(50);
    expect(positivityIndex({})).toBe(0);
  });
});

describe("hourTotals", () => {
  it("sums emotion counts per hour and tracks happy", () => {
    const t = hourTotals([{ hour: "12", Happy: 3, Sad: 1 }]);
    expect(t[0]).toEqual({ hour: "12", total: 4, happy: 3 });
  });
});

describe("buildInsights", () => {
  it("produces narrative bullets and a sentiment comparison", () => {
    const summary = {
      total: 100,
      gender: { Female: 70, Male: 30 },
      age: [{ age: "(20-30)", count: 60 }, { age: "(30-50)", count: 40 }],
      emotion: { Happy: 60, Sad: 40 },
      gi: { individual: 60, group: 40 },
      byHour: [{ hour: "12", Happy: 30 }, { hour: "13", Happy: 10 }],
    };
    const prev = { emotion: { Happy: 40, Sad: 60 } };
    const out = buildInsights(summary, prev);
    expect(out.length).toBeGreaterThanOrEqual(4);
    expect(out.some((s) => /Busiest/.test(s))).toBe(true);
    expect(out.some((s) => /sentiment/i.test(s))).toBe(true);
  });
  it("returns nothing without data", () => {
    expect(buildInsights({ total: 0 })).toEqual([]);
  });
});

describe("detectAnomalies", () => {
  it("flags a footfall spike against the baseline", () => {
    const byHour = [
      { hour: "09", Happy: 5 }, { hour: "10", Happy: 5 }, { hour: "11", Happy: 5 },
      { hour: "12", Happy: 5 }, { hour: "13", Happy: 100 },
    ];
    const out = detectAnomalies(byHour);
    expect(out.some((s) => /spiked around 13/.test(s))).toBe(true);
  });
  it("returns nothing with too little data", () => {
    expect(detectAnomalies([{ hour: "09", Happy: 1 }])).toEqual([]);
  });
});

describe("local dates", () => {
  it("fmt uses the local calendar day, not UTC", () => {
    // 23:30 local on Oct 27 is still Oct 27 whatever the offset.
    expect(fmt(new Date(2026, 9, 27, 23, 30))).toBe("2026-10-27");
  });
  it("parseDate reads YYYY-MM-DD as a local day", () => {
    const d = parseDate("2026-10-27");
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 9, 27]);
  });
});

describe("trendRange / dailySeries", () => {
  it("'today' widens to the last 14 days", () => {
    expect(trendRange("today", new Date(2026, 9, 29))).toEqual({ from: "2026-10-16", to: "2026-10-29" });
  });
  it("fills missing days with zero and marks today", () => {
    const s = dailySeries([{ date: "2026-10-27", count: 5 }, { date: "2026-10-29", count: 2 }], "2026-10-27", "2026-10-29", "2026-10-29");
    expect(s.map((d) => [d.date, d.count, d.isToday])).toEqual([
      ["2026-10-27", 5, false], ["2026-10-28", 0, false], ["2026-10-29", 2, true],
    ]);
  });
  it("without bounds spans the data", () => {
    expect(dailySeries([{ date: "2026-10-01", count: 1 }, { date: "2026-10-03", count: 1 }]).length).toBe(3);
  });
});

describe("footfallSeries", () => {
  it("averages per day and lines up the comparison by hour", () => {
    const s = footfallSeries({ hours: [{ hour: "10", count: 20 }, { hour: "12", count: 40 }], days: 2 },
      { hours: [{ hour: "11", count: 7 }], days: 1 });
    expect(s).toEqual([
      { hour: "10", current: 10, compare: 0 },
      { hour: "11", current: 0, compare: 7 },
      { hour: "12", current: 20, compare: 0 },
    ]);
  });
  it("is empty without data", () => {
    expect(footfallSeries({ hours: [], days: 0 })).toEqual([]);
  });
});

describe("weeklyMatrix", () => {
  it("orders Monday first and finds the peaks", () => {
    const m = weeklyMatrix([{ dow: 6, hour: "12", avg: 15 }, { dow: 1, hour: "09", avg: 3 }, { dow: 0, hour: "12", avg: 8 }], 2);
    expect(m.rows.map((r) => r.day)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
    expect(m.hours).toEqual(["09", "12"]);
    expect(m.rows[5].values).toEqual([0, 15]);
    expect(m.max).toBe(15);
    expect(m.peaks).toEqual([{ day: "Sat", hour: "12", avg: 15 }, { day: "Sun", hour: "12", avg: 8 }]);
  });
});

describe("emotionShares", () => {
  it("sorts largest first with percentages", () => {
    expect(emotionShares({ Sad: 1, Happy: 3 })).toEqual([
      { name: "Happy", value: 3, pct: 75 }, { name: "Sad", value: 1, pct: 25 },
    ]);
  });
});
