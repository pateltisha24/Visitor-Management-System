import { describe, it, expect } from "vitest";
import {
  presetRange, previousRange, pctDelta, positivityIndex, hourTotals,
  buildInsights, detectAnomalies, fmt, parseDate, trendRange, dailySeries,
  footfallSeries, weeklyMatrix, emotionShares, hourSpan, ageLabel, visitorChange,
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
  const summary = {
    total: 140, days: 7,
    gender: { Female: 77, Male: 63 },
    age: [{ age: "(20-30)", count: 60 }, { age: "(30-50)", count: 40 }],
    emotion: { Happy: 60, Neutral: 40, Sad: 40 },
    gi: { individual: 100, group: 40 },
    byHour: [{ hour: "09", Happy: 7 }, { hour: "12", Happy: 70 }, { hour: "15", Happy: 14 }, { hour: "18", Happy: 49 }],
  };
  const prev = { total: 200, emotion: { Happy: 40, Sad: 60 } };
  const out = buildInsights(summary, prev, { compareLabel: "the previous 7 days", returning: 12 });

  it("speaks plainly: clock times, per-day figures, comparisons", () => {
    expect(out).toContain("Your busiest time was 12–1 pm, with about 10 visitors a day. Make sure you have enough staff on then.");
    expect(out).toContain("It was quietest at 9–10 am (about 1 a day), a good time for restocking or breaks.");
    expect(out).toContain("You had 30% fewer visitors than the previous 7 days.");
    expect(out).toContain("Most visitors were aged 20–30, and slightly more women than men came in.");
    expect(out).toContain("43% of people looked happy, better than the previous 7 days.");
    expect(out).toContain("12 people came back later the same day.");
  });
  it("never uses chart or analyst words", () => {
    expect(out.join(" ")).not.toMatch(/reading|sentiment|skew|distribution|demographic|\b\d{2}:00\b/i);
  });
  it("returns nothing without data", () => {
    expect(buildInsights({ total: 0 })).toEqual([]);
  });
});

describe("hourSpan / ageLabel", () => {
  it("formats clock times like a person would", () => {
    expect(hourSpan("12")).toBe("12–1 pm");
    expect(hourSpan("09")).toBe("9–10 am");
    expect(hourSpan("11")).toBe("11 am–12 pm");
    expect(hourSpan("23")).toBe("11 pm–12 am");
  });
  it("turns age buckets into words", () => {
    expect(ageLabel("(20-30)")).toBe("20–30");
    expect(ageLabel("(0-10)")).toBe("under 10");
    expect(ageLabel("(60-80)")).toBe("over 60");
  });
});

describe("detectAnomalies", () => {
  it("flags a busy spike in plain words", () => {
    const byHour = [
      { hour: "09", Happy: 5 }, { hour: "10", Happy: 5 }, { hour: "11", Happy: 5 },
      { hour: "12", Happy: 5 }, { hour: "13", Happy: 100 },
    ];
    const out = detectAnomalies(byHour);
    expect(out.some((s) => /Unusually busy at 1–2 pm: 100 visitors/.test(s))).toBe(true);
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

describe("visitorChange", () => {
  it("today: compares with the same weekday last week up to the same hour", () => {
    const c = visitorChange({
      preset: "today", summary: { total: 30 }, compareWeekday: "Thursday", nowHour: 11,
      hourlyCmp: { hours: [{ hour: "09", count: 10 }, { hour: "11", count: 30 }, { hour: "18", count: 500 }], days: 1 },
    });
    expect(c).toEqual({ pct: -25, label: "the same time last Thursday", perDay: false });   // 30 vs 40, not vs 540
  });
  it("multi-day: compares averages per complete day", () => {
    const c = visitorChange({
      preset: "7d", prev: { total: 700, days: 7 },
      hourly: { hours: [{ hour: "12", count: 660 }], days: 6 },                             // 110/day vs 100/day
    });
    expect(c).toEqual({ pct: 10, label: "the previous 7 days", perDay: true });
  });
  it("is null without a baseline", () => {
    expect(visitorChange({ preset: "7d", prev: null, hourly: { hours: [], days: 0 } })).toBeNull();
  });
});
