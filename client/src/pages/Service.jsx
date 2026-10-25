import React, { useState, useEffect, useCallback, useRef } from "react";
import { NavLink } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../store/auth";
import { FiRefreshCw, FiActivity, FiDatabase, FiDownload, FiRotateCcw, FiX } from "react-icons/fi";
import { DashboardView } from "../components/dashboard/DashboardView";
import { LivePanel } from "../components/dashboard/LivePanel";
import { useRealtime } from "../lib/realtime";
import { sampleSummary, samplePrevSummary, sampleRecent } from "../components/dashboard/sampleData";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { cn } from "../lib/utils";
import { RANGE_PRESETS, presetRange, previousRange, downloadCSV } from "../lib/format";

const POLL_MS = 10000;
// With the realtime connection up, polling is only a safety net.
const POLL_MS_REALTIME = 30000;
// Coalesce bursts of new readings into at most one refetch per this window.
const REFRESH_THROTTLE_MS = 1500;
const MAX_ACTIVITY = 30;
const SINCE_KEY = "facesense.since";

const readSince = () => { try { return localStorage.getItem(SINCE_KEY) || ""; } catch { return ""; } };
const writeSince = (v) => { try { v ? localStorage.setItem(SINCE_KEY, v) : localStorage.removeItem(SINCE_KEY); } catch { /* storage blocked */ } };
const GI_OPTS = [{ v: "", l: "All" }, { v: "individual", l: "Solo" }, { v: "group", l: "Groups" }];
const GENDER_OPTS = [{ v: "", l: "All" }, { v: "Female", l: "Female" }, { v: "Male", l: "Male" }];

export const Service = () => {
  const { user, isDemo, isOffline } = useAuth();
  const [preset, setPreset] = useState("7d");
  const [filters, setFilters] = useState({ gender: "", gi: "", camera: "" });
  const [summary, setSummary] = useState(null);
  const [prev, setPrev] = useState(null);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [live, setLive] = useState(true);
  // Sample (seeded demo) data is opt-in for real users and on by default for the demo.
  const [sample, setSample] = useState(isDemo || isOffline);
  const [lastUpdated, setLastUpdated] = useState(null);
  // "Start fresh": only count readings from this instant on (non-destructive).
  const [since, setSince] = useState(readSince);
  const [cameraOptions, setCameraOptions] = useState([]);
  const [activity, setActivity] = useState([]);
  const timer = useRef(null);
  const reqId = useRef(0);   // guards against out-of-order responses
  const refreshTimer = useRef(null);
  const lastFetchAt = useRef(0);

  const realtime = useRealtime(!isOffline);
  const { subscribe, cameras: onlineCameras } = realtime;
  const realtimeLive = realtime.status === "live";

  // Default to sample mode once we know this is the demo account.
  useEffect(() => { if (isDemo) setSample(true); }, [isDemo]);

  const queryString = useCallback((range, extra = {}) => {
    const p = new URLSearchParams();
    if (range?.from) p.set("from", range.from);
    if (range?.to) p.set("to", range.to);
    if (filters.gender) p.set("gender", filters.gender);
    if (filters.gi) p.set("gi", filters.gi);
    if (filters.camera) p.set("camera", filters.camera);
    if (sample) p.set("sample", "true");   // request the seeded demo data
    else if (since) p.set("since", since);
    Object.entries(extra).forEach(([k, v]) => v != null && p.set(k, v));
    const s = p.toString();
    return s ? `?${s}` : "";
  }, [filters, sample, since]);

  const fetchAll = useCallback(async () => {
    const myId = ++reqId.current;
    // Offline fallback (API unreachable): use bundled static sample data.
    if (isOffline) {
      setSummary(sampleSummary); setPrev(samplePrevSummary); setRecent(sampleRecent);
      setLoading(false); setError(false); setLastUpdated(new Date());
      return;
    }
    lastFetchAt.current = Date.now();
    try {
      const range = presetRange(preset);
      // A fresh session has no meaningful "previous period" to compare against.
      const prevR = since && !sample ? null : previousRange(range.from, range.to);
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
  }, [isOffline, preset, queryString, since, sample]);

  useEffect(() => { setLoading(true); fetchAll(); }, [fetchAll]);

  useEffect(() => {
    clearInterval(timer.current);
    if (live && !sample && !isOffline) timer.current = setInterval(fetchAll, realtimeLive ? POLL_MS_REALTIME : POLL_MS);
    return () => clearInterval(timer.current);
  }, [live, sample, isOffline, fetchAll, realtimeLive]);

  // Refetch soon after a new reading arrives, throttled so a busy camera can't
  // flood the API (the latest fetchAll is read through a ref).
  const fetchAllRef = useRef(fetchAll);
  useEffect(() => { fetchAllRef.current = fetchAll; }, [fetchAll]);
  const liveRefresh = live && !sample && !isOffline;
  const liveRefreshRef = useRef(liveRefresh);
  useEffect(() => { liveRefreshRef.current = liveRefresh; }, [liveRefresh]);
  useEffect(() => () => clearTimeout(refreshTimer.current), []);

  useEffect(() => subscribe((msg) => {
    let item = null;
    if (msg.type === "reading") {
      const r = msg.reading;
      item = { kind: "visitor", cameraName: r.cameraName || "Camera", emotion: r.Emotion, text: `${r.Gender}, ${r.Age} · ${r.Emotion}` };
    } else if (msg.type === "event" && msg.kind === "visitor_counted") {
      item = { kind: "visitor", cameraName: msg.cameraName, emotion: msg.emotion, text: `${msg.gender}, ${msg.age} · ${msg.emotion}` };
    } else if (msg.type === "event" && msg.kind === "returning_visitor") {
      item = { kind: "returning_visitor", cameraName: msg.cameraName, text: "Returning visitor, not double-counted" };
    }
    if (!item) return;
    setActivity((a) => [{ ...item, id: `${Date.now()}-${Math.random()}`, at: new Date() }, ...a].slice(0, MAX_ACTIVITY));

    if (item.kind === "visitor" && liveRefreshRef.current && !refreshTimer.current) {
      const wait = Math.max(0, REFRESH_THROTTLE_MS - (Date.now() - lastFetchAt.current));
      refreshTimer.current = setTimeout(() => { refreshTimer.current = null; fetchAllRef.current(); }, wait);
    }
  }), [subscribe]);

  // Cameras for the filter: every camera with readings, plus whatever is online now.
  useEffect(() => {
    if (isOffline) return;
    let cancelled = false;
    api.get(`/api/cameras${sample ? "?sample=true" : ""}`)
      .then((res) => { if (!cancelled) setCameraOptions(res.data || []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isOffline, sample, onlineCameras]);

  // Drop a camera filter that no longer applies (e.g. after toggling sample data).
  useEffect(() => {
    if (filters.camera && !cameraOptions.some((c) => c.cameraId === filters.camera)) {
      setFilters((f) => ({ ...f, camera: "" }));
    }
  }, [cameraOptions, filters.camera]);

  const startFresh = () => {
    const now = new Date().toISOString();
    writeSince(now); setSince(now); setPreset("today"); setActivity([]);
  };
  const clearFresh = () => { writeSince(""); setSince(""); };

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
              {!sample && !isOffline && (realtimeLive ? " · realtime" : live ? " · polling every 10s" : "")}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!sample && !isOffline && (
              <Button variant="outline" size="sm" onClick={startFresh} title="Count only visitors from now on (nothing is deleted)">
                <FiRotateCcw /> Start fresh
              </Button>
            )}
            <Button variant={live ? "default" : "outline"} size="sm" onClick={() => setLive((v) => !v)} disabled={sample} title={realtimeLive ? "Update as visitors arrive" : "Auto-refresh every 10s"}>
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
          {cameraOptions.length > 0 && (
            <Segmented
              options={[{ v: "", l: "All cameras" }, ...cameraOptions.map((c) => ({ v: c.cameraId, l: c.cameraName }))]}
              value={filters.camera}
              onChange={(v) => setFilters((f) => ({ ...f, camera: v }))}
            />
          )}
          {sample && <span className="text-xs font-medium text-primary">Viewing sample data</span>}
          {since && !sample && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              Counting since {new Date(since).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
              <button onClick={clearFresh} title="Show all readings again" className="hover:text-foreground"><FiX /></button>
            </span>
          )}
        </div>

        {/* Live camera view + activity (needs the realtime server) */}
        {realtimeLive && !sample && (
          <div className="mt-6">
            <LivePanel cameras={realtime.cameras} subscribeFrames={realtime.subscribeFrames} setPreview={realtime.setPreview} activity={activity} />
          </div>
        )}

        {/* Body */}
        <div className="mt-6">
          {loading ? (
            <SkeletonGrid />
          ) : hasData ? (
            <DashboardView summary={summary} prevSummary={prev} recent={recent} />
          ) : (
            <EmptyState error={error} fresh={!!since && !sample} onSample={() => setSample(true)} />
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

const EmptyState = ({ error, fresh, onSample }) => (
  <Card className="mx-auto max-w-xl p-10 text-center">
    <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
      <FiDatabase size={24} />
    </div>
    <h2 className="mt-5 text-xl font-semibold">{error ? "Can't reach the analytics service" : fresh ? "No visitors yet" : "No data yet"}</h2>
    <p className="mt-2 text-sm text-muted-foreground">
      {error
        ? "We couldn't load analytics. Check that the API and database are configured, then try again."
        : fresh
          ? "Counting started fresh. Charts fill in as soon as the first visitor is counted."
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
