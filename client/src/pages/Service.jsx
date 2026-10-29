import React, { useState, useEffect, useCallback, useRef } from "react";
import { NavLink } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../store/auth";
import { FiRefreshCw, FiActivity, FiDatabase, FiDownload, FiRotateCcw, FiX } from "react-icons/fi";
import { DashboardView, WorthALook } from "../components/dashboard/DashboardView";
import { DayPicker } from "../components/dashboard/DayPicker";
import { LivePanel } from "../components/dashboard/LivePanel";
import { useRealtime } from "../lib/realtime";
import { sampleSummary, samplePrevSummary, sampleRecent } from "../components/dashboard/sampleData";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { cn } from "../lib/utils";
import {
  lastDays, downloadCSV, fmt, addDays, parseDate, dailySeries, monthlySeries, monthsFromDaily,
  footfallSeries, typicalDay, weeklyMatrix, visitorChange, detectAnomalies, personLabel,
} from "../lib/format";

const POLL_MS = 10000;
// With the realtime connection up, polling is only a safety net.
const POLL_MS_REALTIME = 30000;
// Coalesce bursts of new readings into at most one refetch per this window.
const REFRESH_THROTTLE_MS = 2500;
const MAX_ACTIVITY = 30;
const SINCE_KEY = "facesense.since";

const readSince = () => { try { return localStorage.getItem(SINCE_KEY) || ""; } catch { return ""; } };
const writeSince = (v) => { try { v ? localStorage.setItem(SINCE_KEY, v) : localStorage.removeItem(SINCE_KEY); } catch { /* storage blocked */ } };

export const Service = () => {
  const { user, isDemo, isOffline } = useAuth();
  const [filters, setFilters] = useState({ camera: "" });
  const [summary, setSummary] = useState(null);
  const [prev, setPrev] = useState(null);
  const [recent, setRecent] = useState([]);
  const [trends, setTrends] = useState(null);
  const [change, setChange] = useState(null);   // like-for-like visitor change
  // The dashboard shows one day: today unless another is picked (null = today,
  // so it rolls over at midnight). Comparisons are with the same weekday a week
  // earlier, and the Traffic card's tabs give the longer view around it.
  const [picked, setPicked] = useState(null);
  const [days, setDays] = useState([]);   // dates with visitors, for the calendar
  const today = fmt(new Date());
  const day = picked || today;
  const isToday = day === today;
  const weekday = parseDate(day).toLocaleDateString(undefined, { weekday: "long" });
  const weekdayShort = parseDate(day).toLocaleDateString(undefined, { weekday: "short" });
  const compareLabel = isToday ? `last ${weekday}` : `the ${weekday} before`;
  const compareShort = isToday ? `last ${weekdayShort}`
    : addDays(parseDate(day), -7).toLocaleDateString(undefined, { month: "short", day: "numeric" });
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
    if (filters.camera) p.set("camera", filters.camera);
    if (sample) p.set("sample", "true");   // request the seeded demo data
    else if (since && isToday) p.set("since", since);   // "start fresh" is about today
    Object.entries(extra).forEach(([k, v]) => v != null && p.set(k, v));
    const s = p.toString();
    return s ? `?${s}` : "";
  }, [filters, sample, since, isToday]);

  const fetchAll = useCallback(async () => {
    const myId = ++reqId.current;
    // Offline fallback (API unreachable): use bundled static sample data.
    if (isOffline) {
      setSummary(sampleSummary); setPrev(samplePrevSummary); setRecent(sampleRecent); setTrends(null);
      setLoading(false); setError(false); setLastUpdated(new Date());
      return;
    }
    lastFetchAt.current = Date.now();
    try {
      const date = parseDate(day);
      const range = { from: day, to: day };
      // A fresh session has no meaningful "before" to compare against.
      const fresh = since && !sample && isToday;
      const weekEarlier = fmt(addDays(date, -7));
      const weekEarlierR = fresh ? null : { from: weekEarlier, to: weekEarlier };
      const dailyR = lastDays(30, date);
      // Day-by-day history for "Over time": two years up to today, so zooming
      // and moving between weeks, months and years needs no extra requests.
      const historyR = { from: fmt(new Date(date.getFullYear(), date.getMonth() - 23, 1)), to: today };
      // The weekly pattern averages the 4 complete weeks before the day.
      const weeklyR = { from: fmt(addDays(date, -28)), to: fmt(addDays(date, -1)) };
      // A past day is complete; today only up to now.
      const nowHour = isToday ? new Date().getHours() : 23;
      const get = (path, r, extra) => api.get(`/api/analytics/${path}${queryString(r, extra)}`).then((res) => res.data);
      const [sum, recentRows, prevSum, hourly, hourlyCmp, history, weekly] = await Promise.all([
        get("summary", range),
        get("recent", range, { limit: 10 }),
        weekEarlierR ? get("summary", weekEarlierR) : null,
        get("hourly", range),
        weekEarlierR ? get("hourly", weekEarlierR) : null,
        get("daily", historyR),
        get("weekly", weeklyR),
      ]);
      if (myId !== reqId.current) return; // a newer request superseded this one
      setSummary(sum);
      setRecent(recentRows || []);
      setPrev(prevSum);
      setChange(fresh ? null : visitorChange({
        summary: sum, hourlyCmp, nowHour,
        label: isToday ? `the same time last ${weekday}` : `the ${weekday} before`,
      }));
      const shortDate = date.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
      const prevName = isToday ? `Last ${weekday}` : `The ${weekday} before`;
      setTrends({
        footfall: {
          // Only today has hours still to come, shown as a typical day.
          data: footfallSeries(hourly, hourlyCmp, isToday ? { expected: typicalDay(weekly?.cells, date.getDay()), nowHour } : {}),
          description: `Visitors per hour ${isToday ? "today" : `on ${shortDate}`}${hourlyCmp ? `, against ${isToday ? `last ${weekday}` : `the ${weekday} before`}` : ""}.`,
          currentLabel: isToday ? "Today" : shortDate,
          compareLabel: hourlyCmp ? prevName : null,
          expectedLabel: `Typical ${weekday}`,
          nowHour: isToday ? nowHour : null,
        },
        overTime: { history: history || [] },
        // Also what Ask is told about the days and months around the day.
        daily: { data: dailySeries(history, dailyR.from, dailyR.to, day) },
        monthly: { data: monthlySeries(monthsFromDaily(history), 12, date) },
        weekly: {
          matrix: weeklyMatrix(weekly?.cells || []),
          description: `Your regular week over the 4 weeks before ${isToday ? "today" : shortDate} — darker means busier.`,
        },
      });
      setError(false); setLastUpdated(new Date());
    } catch {
      if (myId === reqId.current) setError(true);
    } finally {
      if (myId === reqId.current) setLoading(false);
    }
  }, [isOffline, queryString, since, sample, day, today, isToday, weekday]);

  useEffect(() => { setLoading(true); fetchAll(); }, [fetchAll]);

  useEffect(() => {
    clearInterval(timer.current);
    if (live && !sample && !isOffline && isToday) timer.current = setInterval(fetchAll, realtimeLive ? POLL_MS_REALTIME : POLL_MS);
    return () => clearInterval(timer.current);
  }, [live, sample, isOffline, isToday, fetchAll, realtimeLive]);

  // Refetch soon after a new reading arrives, throttled so a busy camera can't
  // flood the API (the latest fetchAll is read through a ref).
  const fetchAllRef = useRef(fetchAll);
  useEffect(() => { fetchAllRef.current = fetchAll; }, [fetchAll]);
  // A past day doesn't change, so new readings only refresh today.
  const liveRefresh = live && !sample && !isOffline && isToday;
  const liveRefreshRef = useRef(liveRefresh);
  useEffect(() => { liveRefreshRef.current = liveRefresh; }, [liveRefresh]);
  useEffect(() => () => clearTimeout(refreshTimer.current), []);

  useEffect(() => subscribe((msg) => {
    let item = null;
    if (msg.type === "reading") {
      const r = msg.reading;
      item = { kind: "visitor", cameraName: r.cameraName || "Camera", emotion: r.Emotion, text: `${personLabel(r.Gender, r.Age)} · ${r.Emotion}` };
    } else if (msg.type === "event" && msg.kind === "visitor_counted") {
      item = { kind: "visitor", cameraName: msg.cameraName, emotion: msg.emotion, text: `${personLabel(msg.gender, msg.age)} · ${msg.emotion}` };
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

  // Days with visitors, for the calendar (refreshed when sample data is toggled).
  useEffect(() => {
    if (isOffline) return;
    let cancelled = false;
    api.get(`/api/analytics/dates${sample ? "?sample=true" : ""}`)
      .then((res) => { if (!cancelled) setDays(res.data || []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isOffline, sample]);

  // Drop a camera filter that no longer applies (e.g. after toggling sample data).
  useEffect(() => {
    if (filters.camera && !cameraOptions.some((c) => c.cameraId === filters.camera)) {
      setFilters((f) => ({ ...f, camera: "" }));
    }
  }, [cameraOptions, filters.camera]);

  const startFresh = () => {
    const now = new Date().toISOString();
    writeSince(now); setSince(now); setPicked(null); setActivity([]);
  };
  const clearFresh = () => { writeSince(""); setSince(""); };

  const exportCsv = async () => {
    try {
      if (isOffline) return downloadCSV(sampleRecent, "facesense-sample.csv");
      const res = await api.get(`/api/data${queryString(null)}`);
      downloadCSV(res.data, `facesense-${sample ? "sample" : "readings"}.csv`);
    } catch {
      /* surfaced via empty file guard */
    }
  };

  const hasData = summary && summary.total > 0;

  // On wide screens the page is exactly one screen tall and the dashboard fills what's left.
  return (
    <main className="flex min-h-[calc(100vh-4rem)] flex-col bg-secondary/20 xl:h-[calc(100vh-4rem)]">
      <div className="flex min-h-0 flex-1 flex-col px-4 py-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-baseline gap-x-3">
            <h1 className="font-display text-2xl font-bold tracking-tight">Visitor analytics</h1>
            <p className="text-sm text-muted-foreground">
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
            {!sample && (
              <Button variant={live ? "default" : "outline"} size="sm" onClick={() => setLive((v) => !v)} title={realtimeLive ? "Update as visitors arrive" : "Auto-refresh every 10s"}>
                <FiActivity className={live ? "animate-pulse" : ""} /> {live ? "Live" : "Paused"}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={fetchAll} title="Refresh now"><FiRefreshCw /></Button>
            <Button variant="outline" size="sm" onClick={exportCsv} title="Export every reading as CSV"><FiDownload /> Export</Button>
            <Button variant={sample ? "default" : "secondary"} size="sm" onClick={() => setSample((v) => !v)}>
              <FiDatabase /> {sample ? "Sample on" : "Sample data"}
            </Button>
          </div>
        </div>

        {/* Day + camera filter */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <DayPicker value={day} today={today} available={days} onChange={(d) => setPicked(d === today ? null : d)} />
          {!isToday && (
            <button onClick={() => setPicked(null)} className="rounded-full px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10">
              Back to today
            </button>
          )}
          <span className="mx-1 hidden h-5 w-px bg-border sm:block" />
          {cameraOptions.length > 0 && (
            <Segmented
              options={[{ v: "", l: "All cameras" }, ...cameraOptions.map((c) => ({ v: c.cameraId, l: c.cameraName }))]}
              value={filters.camera}
              onChange={(v) => setFilters((f) => ({ ...f, camera: v }))}
            />
          )}
          {sample && <span className="text-xs font-medium text-primary">Viewing sample data</span>}
          {since && !sample && isToday && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              Counting since {new Date(since).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
              <button onClick={clearFresh} title="Show all readings again" className="hover:text-foreground"><FiX /></button>
            </span>
          )}
          {hasData && <div className="ml-auto"><WorthALook items={detectAnomalies(summary.byHour || [])} /></div>}
        </div>

        {/* Live camera view + activity (needs the realtime server) */}
        {realtimeLive && !sample && isToday && (
          <div className="mt-4">
            <LivePanel cameras={realtime.cameras} subscribeFrames={realtime.subscribeFrames} setPreview={realtime.setPreview} activity={activity} />
          </div>
        )}

        {/* Body */}
        <div className="mt-4 min-h-0 flex-1">
          {/* The placeholder only before the first load: later reloads (another day,
              a camera filter) keep the cards, and their tabs and zoom, on screen. */}
          {loading && !summary ? (
            <SkeletonGrid />
          ) : hasData ? (
            <DashboardView summary={summary} prevSummary={prev} recent={recent} trends={trends}
                           context={{ compareLabel, compareShort, visitorChange: change, day, today, isToday }} />
          ) : (
            <EmptyState error={error} fresh={!!since && !sample && isToday} onSample={() => setSample(true)} />
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
