import { describe, it, expect } from "vitest";
import {
  presetRange, previousRange, pctDelta, positivityIndex, hourTotals,
  buildInsights, detectAnomalies,
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
