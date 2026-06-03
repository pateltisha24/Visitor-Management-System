import React, { useState, useEffect, useCallback, useRef } from "react";
import { NavLink } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../store/auth";
import { FiRefreshCw, FiActivity, FiDatabase, FiDownload } from "react-icons/fi";
import { DashboardView } from "../components/dashboard/DashboardView";
import { sampleSummary, samplePrevSummary, sampleRecent } from "../components/dashboard/sampleData";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { cn } from "../lib/utils";
import { RANGE_PRESETS, presetRange, previousRange, downloadCSV } from "../lib/format";

const POLL_MS = 10000;
const GI_OPTS = [{ v: "", l: "All" }, { v: "individual", l: "Solo" }, { v: "group", l: "Groups" }];
const GENDER_OPTS = [{ v: "", l: "All" }, { v: "Female", l: "Female" }, { v: "Male", l: "Male" }];

export const Service = () => {
  const { user, isDemo, isOffline } = useAuth();
  const [preset, setPreset] = useState("7d");
  const [filters, setFilters] = useState({ gender: "", gi: "" });
  const [summary, setSummary] = useState(null);
  const [prev, setPrev] = useState(null);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [live, setLive] = useState(true);
  // Sample (seeded demo) data is opt-in for real users and on by default for the demo.
  const [sample, setSample] = useState(isDemo || isOffline);
  const [lastUpdated, setLastUpdated] = useState(null);
  const timer = useRef(null);
  const reqId = useRef(0);   // guards against out-of-order responses

  // Default to sample mode once we know this is the demo account.
  useEffect(() => { if (isDemo) setSample(true); }, [isDemo]);

  const queryString = useCallback((range, extra = {}) => {
    const p = new URLSearchParams();
    if (range?.from) p.set("from", range.from);
    if (range?.to) p.set("to", range.to);
    if (filters.gender) p.set("gender", filters.gender);
    if (filters.gi) p.set("gi", filters.gi);
    if (sample) p.set("sample", "true");   // request the seeded demo data
    Object.entries(extra).forEach(([k, v]) => v != null && p.set(k, v));
    const s = p.toString();
    return s ? `?${s}` : "";
  }, [filters, sample]);

  const fetchAll = useCallback(async () => {
    const myId = ++reqId.current;
    // Offline fallback (API unreachable): use bundled static sample data.
    if (isOffline) {
      setSummary(sampleSummary); setPrev(samplePrevSummary); setRecent(sampleRecent);
      setLoading(false); setError(false); setLastUpdated(new Date());
      return;
    }
    try {
      const range = presetRange(preset);
      const prevR = previousRange(range.from, range.to);
      const [sumRes, recentRes, prevRes] = await Promise.all([
        api.get(`/api/analytics/summary${queryString(range)}`),
        api.get(`/api/analytics/recent${queryString(range, { limit: 10 })}`),
        prevR ? api.get(`/api/analytics/summary${queryString(prevR)}`) : Promise.resolve(null),
      ]);
      if (myId !== reqId.current) return; // a newer request superseded this one
      setSummary(sumRes.data);
      setRecent(recentRes.data || []);
      setPrev(prevRes ? prevRes.data : null);
      setError(false); setLastUpdated(new Date());
    } catch {
      if (myId === reqId.current) setError(true);
    } finally {
      if (myId === reqId.current) setLoading(false);
    }
  }, [isOffline, preset, queryString]);

  useEffect(() => { setLoading(true); fetchAll(); }, [fetchAll]);

  useEffect(() => {
    clearInterval(timer.current);
    if (live && !sample && !isOffline) timer.current = setInterval(fetchAll, POLL_MS);
    return () => clearInterval(timer.current);
  }, [live, sample, isOffline, fetchAll]);

  const exportCsv = async () => {
    try {
      if (isOffline) return downloadCSV(sampleRecent, "facesense-sample.csv");
      const range = presetRange(preset);
      const res = await api.get(`/api/data${queryString(range)}`);
      downloadCSV(res.data, `facesense-${sample ? "sample" : preset}.csv`);
    } catch {
      /* surfaced via empty file guard */
    }
  };

  const hasData = summary && summary.total > 0;

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-secondary/20">
      <div className="px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">Visitor analytics</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {user?.organisation ? `${user.organisation} · ` : ""}
              {sample ? "Sample data preview" : "Live insights from your cameras"}
              {lastUpdated && !sample && ` · updated ${lastUpdated.toLocaleTimeString()}`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant={live ? "default" : "outline"} size="sm" onClick={() => setLive((v) => !v)} disabled={sample} title="Auto-refresh every 10s">
              <FiActivity className={live && !sample ? "animate-pulse" : ""} /> {live && !sample ? "Live" : "Paused"}
            </Button>
            <Button variant="outline" size="sm" onClick={fetchAll} title="Refresh now"><FiRefreshCw /></Button>
            <Button variant="outline" size="sm" onClick={exportCsv} title="Export CSV"><FiDownload /> Export</Button>
            <Button variant={sample ? "default" : "secondary"} size="sm" onClick={() => setSample((v) => !v)}>
              <FiDatabase /> {sample ? "Sample on" : "Sample data"}
            </Button>
          </div>
        </div>

        {/* Range + filters */}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Segmented options={RANGE_PRESETS.map((r) => ({ v: r.key, l: r.label }))} value={preset} onChange={setPreset} />
          <span className="mx-1 hidden h-5 w-px bg-border sm:block" />
          <Segmented options={GENDER_OPTS} value={filters.gender} onChange={(v) => setFilters((f) => ({ ...f, gender: v }))} />
          <Segmented options={GI_OPTS} value={filters.gi} onChange={(v) => setFilters((f) => ({ ...f, gi: v }))} />
          {sample && <span className="text-xs font-medium text-primary">Viewing sample data</span>}
        </div>

        {/* Body */}
        <div className="mt-6">
          {loading ? (
            <SkeletonGrid />
          ) : hasData ? (
            <DashboardView summary={summary} prevSummary={prev} recent={recent} />
          ) : (
            <EmptyState error={error} onSample={() => setSample(true)} />
          )}
        </div>
      </div>
    </main>
  );
};

const Segmented = ({ options, value, onChange, disabled }) => (
  <div className={cn("inline-flex rounded-full border border-border bg-card p-1", disabled && "opacity-50")}>
    {options.map((o) => (
      <button
        key={o.v}
        disabled={disabled}
        onClick={() => onChange(o.v)}
        className={cn(
          "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
          value === o.v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
        )}
      >
        {o.l}
      </button>
    ))}
  </div>
);

const SkeletonGrid = () => (
  <div className="space-y-6">
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {[0, 1, 2, 3].map((i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-card" />)}
    </div>
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <div className="h-80 animate-pulse rounded-2xl bg-card" />
      <div className="h-80 animate-pulse rounded-2xl bg-card" />
    </div>
  </div>
);

const EmptyState = ({ error, onSample }) => (
  <Card className="mx-auto max-w-xl p-10 text-center">
    <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
      <FiDatabase size={24} />
    </div>
    <h2 className="mt-5 text-xl font-semibold">{error ? "Can't reach the analytics service" : "No data yet"}</h2>
    <p className="mt-2 text-sm text-muted-foreground">
      {error
        ? "We couldn't load analytics. Check that the API and database are configured, then try again."
        : "Once your camera pipeline starts writing readings, charts will appear here automatically."}
    </p>
    <div className="mt-6 flex flex-wrap justify-center gap-3">
      <Button onClick={onSample}><FiDatabase /> Preview with sample data</Button>
      <Button asChild variant="outline"><NavLink to="/connect">Connect a camera</NavLink></Button>
    </div>
    <p className="mt-4 text-xs text-muted-foreground">Sample mode renders representative data so you can explore the dashboard.</p>
  </Card>
);

export default Service;
