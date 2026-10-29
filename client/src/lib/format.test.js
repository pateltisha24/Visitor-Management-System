import { describe, it, expect } from "vitest";
import {
  lastDays, pctDelta, positivityIndex, hourTotals,
  buildInsights, detectAnomalies, fmt, parseDate, dailySeries, monthlySeries,
  footfallSeries, typicalDay, weeklyMatrix, emotionShares, hourSpan, ageLabel, personLabel, visitorChange,
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

describe("lastDays", () => {
  it("counts today as one of the days", () => {
    expect(lastDays(30, new Date(2026, 9, 29))).toEqual({ from: "2026-09-30", to: "2026-10-29" });
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
  it("describes a visitor in words", () => {
    expect(personLabel("Female", "(60-80)")).toBe("Woman, over 60");
    expect(personLabel("Male", "(20-30)")).toBe("Man, 20–30");
    expect(personLabel("Female", "(10-20)")).toBe("Girl, 10–20");
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

describe("dailySeries", () => {
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

describe("monthlySeries", () => {
  it("starts at the first month with visitors and marks the current one", () => {
    const s = monthlySeries([{ month: "2026-08", count: 900 }, { month: "2026-10", count: 300 }], 12, new Date(2026, 9, 29));
    expect(s.map((m) => [m.month, m.count, m.isCurrent])).toEqual([
      ["2026-08", 900, false], ["2026-09", 0, false], ["2026-10", 300, true],
    ]);
  });
  it("shows the year where it changes", () => {
    const s = monthlySeries([{ month: "2025-12", count: 1 }, { month: "2026-01", count: 1 }], 12, new Date(2026, 0, 15));
    expect(s.map((m) => /\d{4}/.test(m.label))).toEqual([true, true]);
  });
  it("is empty without data", () => {
    expect(monthlySeries([], 12, new Date(2026, 9, 29))).toEqual([]);
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
  it("shows what's expected for the hours still to come today", () => {
    const s = footfallSeries({ hours: [{ hour: "09", count: 8 }, { hour: "10", count: 12 }], days: 1 }, null,
      { expected: typicalDay([{ dow: 4, hour: "10", avg: 20 }, { dow: 4, hour: "11", avg: 30.4 }, { dow: 5, hour: "12", avg: 99 }], 4), nowHour: 10 });
    expect(s).toEqual([
      { hour: "09", current: 8, compare: null, expected: null },
      { hour: "10", current: 12, compare: null, expected: null },   // the hour in progress is real, not expected
      { hour: "11", current: null, compare: null, expected: 30 },
    ]);
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
  it("compares today so far with the same weekday last week up to the same hour", () => {
    const c = visitorChange({
      summary: { total: 30 }, label: "the same time last Thursday", nowHour: 11,
      hourlyCmp: { hours: [{ hour: "09", count: 10 }, { hour: "11", count: 30 }, { hour: "18", count: 500 }], days: 1 },
    });
    expect(c).toEqual({ pct: -25, label: "the same time last Thursday" });   // 30 vs 40, not vs 540
  });
  it("is null without a baseline", () => {
    expect(visitorChange({ summary: { total: 5 }, hourlyCmp: null })).toBeNull();
    expect(visitorChange({ summary: { total: 5 }, hourlyCmp: { hours: [] }, nowHour: 9 })).toBeNull();
  });
});
