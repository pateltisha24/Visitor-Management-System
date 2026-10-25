import { useEffect, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { FiVideo, FiVideoOff, FiUserPlus, FiRepeat, FiRadio } from "react-icons/fi";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";
import { emotionColor } from "./theme";

// Live view: the annotated feed of one camera (relayed from the CV pipeline,
// never stored) next to a running log of what the cameras just did.
export const LivePanel = ({ cameras, subscribeFrames, setPreview, activity }) => {
  const [selected, setSelected] = useState(null);
  const [watching, setWatching] = useState(true);
  const camera = cameras.find((c) => c.cameraId === selected);

  // Pick the first previewable camera automatically; drop a camera that went offline.
  useEffect(() => {
    if (selected && cameras.some((c) => c.cameraId === selected)) return;
    const first = cameras.find((c) => c.previewAllowed) || cameras[0];
    setSelected(first ? first.cameraId : null);
  }, [cameras, selected]);

  const streaming = watching && camera?.previewAllowed;
  useEffect(() => {
    setPreview(streaming ? camera.cameraId : null);
    return () => setPreview(null);
  }, [streaming, camera?.cameraId, setPreview]);

  if (!cameras.length) {
    return (
      <Card className="flex flex-wrap items-center gap-4 p-5">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-secondary text-muted-foreground"><FiVideoOff size={18} /></span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">No cameras online</div>
          <p className="text-sm text-muted-foreground">Start the pipeline with <code className="rounded bg-secondary px-1 font-mono text-xs">--allow-preview</code> and its live feed will appear here.</p>
        </div>
        <Button asChild variant="outline" size="sm"><NavLink to="/connect">Connect a camera</NavLink></Button>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-base font-semibold"><FiRadio className="text-primary" /> Live view</h3>
        <div className="flex flex-wrap items-center gap-2">
          {cameras.map((c) => (
            <button
              key={c.cameraId}
              onClick={() => setSelected(c.cameraId)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                c.cameraId === selected ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              {c.cameraName}
              {c.fps != null && <span className="font-mono text-xs text-muted-foreground">{c.fps} fps</span>}
            </button>
          ))}
          {camera?.previewAllowed && (
            <Button variant="outline" size="sm" onClick={() => setWatching((w) => !w)}>
              {watching ? <><FiVideoOff /> Hide video</> : <><FiVideo /> Show video</>}
            </Button>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="relative aspect-video overflow-hidden rounded-xl bg-neutral-900">
          {streaming ? (
            <PreviewImage key={camera.cameraId} subscribeFrames={subscribeFrames} />
          ) : (
            <div className="grid h-full place-items-center p-6 text-center text-sm text-neutral-400">
              {camera?.previewAllowed
                ? "Video hidden. Counting continues."
                : "Preview is off for this camera. Restart its pipeline with --allow-preview to watch it here."}
            </div>
          )}
          {streaming && (
            <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" /> LIVE · not recorded
            </span>
          )}
        </div>

        <div className="min-w-0">
          <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Activity</div>
          <ul className="mt-3 max-h-[300px] space-y-1.5 overflow-y-auto">
            <AnimatePresence initial={false}>
              {activity.length ? activity.map((a) => (
                <motion.li
                  key={a.id}
                  layout
                  initial={{ opacity: 0, y: -8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className={cn(
                    "flex items-start gap-3 rounded-lg px-3 py-2 text-sm",
                    a.kind === "returning_visitor" ? "bg-amber-500/10" : "bg-secondary/60"
                  )}
                >
                  {a.kind === "returning_visitor"
                    ? <FiRepeat className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
                    : <FiUserPlus className="mt-0.5 shrink-0" style={{ color: emotionColor(a.emotion) }} />}
                  <div className="min-w-0 flex-1">
                    <div className="truncate">{a.text}</div>
                    <div className="text-xs text-muted-foreground">{a.cameraName} · {a.at.toLocaleTimeString()}</div>
                  </div>
                </motion.li>
              )) : (
                <li className="rounded-lg bg-secondary/40 px-3 py-3 text-sm text-muted-foreground">Waiting for visitors… new arrivals show up here the moment they&apos;re counted.</li>
              )}
            </AnimatePresence>
          </ul>
        </div>
      </div>
    </Card>
  );
};

// Draws incoming JPEG frames straight into an <img> (no React re-render per frame).
const PreviewImage = ({ subscribeFrames }) => {
  const img = useRef(null);
  const [hasFrame, setHasFrame] = useState(false);

  useEffect(() => {
    let current = null;
    const unsubscribe = subscribeFrames((blob) => {
      const url = URL.createObjectURL(blob);
      if (img.current) img.current.src = url;
      if (current) URL.revokeObjectURL(current);
      current = url;
      setHasFrame(true);
    });
    return () => {
      unsubscribe();
      if (current) URL.revokeObjectURL(current);
    };
  }, [subscribeFrames]);

  return (
    <>
      <img ref={img} alt="Live camera preview" className={cn("h-full w-full object-contain", !hasFrame && "invisible")} />
      {!hasFrame && <div className="absolute inset-0 grid place-items-center text-sm text-neutral-400">Waiting for video…</div>}
    </>
  );
};
