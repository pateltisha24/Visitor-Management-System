import { useEffect, useMemo, useRef, useState } from "react";
import { FiCalendar, FiChevronLeft, FiChevronRight } from "react-icons/fi";
import { Card } from "../ui/card";
import { cn } from "../../lib/utils";
import { fmt, parseDate, addDays } from "../../lib/format";

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
const addMonths = (d, n) => new Date(d.getFullYear(), d.getMonth() + n, 1);

// "Today · Thursday, 29 October", or "Tuesday, 20 October" (with the year when it isn't this year).
function dayLabel(day, today) {
  const d = parseDate(day);
  const long = d.toLocaleDateString(undefined, {
    weekday: "long", day: "numeric", month: "long",
    ...(d.getFullYear() !== parseDate(today).getFullYear() ? { year: "numeric" } : {}),
  });
  return day === today ? `Today · ${long}` : long;
}

// The day the dashboard shows. Arrows step to the previous/next day with
// visitors; the calendar marks those days and only lets you pick them (or today).
//   value, today: "YYYY-MM-DD"; available: sorted dates that have visitors
export const DayPicker = ({ value, today, available = [], onChange }) => {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => startOfMonth(parseDate(value)));
  const ref = useRef(null);
  const has = useMemo(() => new Set(available), [available]);

  useEffect(() => { if (open) setMonth(startOfMonth(parseDate(value))); }, [open, value]);
  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);

  const selectable = (day) => day === today || (has.has(day) && day < today);
  const prevDay = [...available].reverse().find((d) => d < value) || null;
  const nextDay = available.find((d) => d > value && d < today) || (value < today ? today : null);
  const pick = (day) => { onChange(day); setOpen(false); };

  // Monday-first grid for the shown month.
  const first = startOfMonth(month);
  const blanks = (first.getDay() + 6) % 7;
  const days = [];
  for (let d = first; d.getMonth() === first.getMonth(); d = addDays(d, 1)) days.push(fmt(d));
  const earliest = available[0] || today;
  const canPrevMonth = fmt(addMonths(month, -1)) >= fmt(startOfMonth(parseDate(earliest)));
  const canNextMonth = fmt(addMonths(month, 1)) <= today;

  const arrow = "grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent";

  return (
    <div ref={ref} className="relative inline-flex items-center rounded-full border border-border bg-card p-0.5">
      <button className={arrow} onClick={() => prevDay && onChange(prevDay)} disabled={!prevDay} aria-label="Previous day" title="Previous day">
        <FiChevronLeft size={15} />
      </button>
      <button onClick={() => setOpen((v) => !v)} aria-haspopup="dialog" aria-expanded={open}
              className="inline-flex items-center gap-2 rounded-full px-2 py-1 text-sm font-medium hover:bg-secondary">
        <FiCalendar size={14} className="text-primary" /> {dayLabel(value, today)}
      </button>
      <button className={arrow} onClick={() => nextDay && onChange(nextDay)} disabled={!nextDay} aria-label="Next day" title="Next day">
        <FiChevronRight size={15} />
      </button>

      {open && (
        <Card role="dialog" aria-label="Choose a day" className="absolute left-0 top-full z-30 mt-2 w-72 p-3 shadow-lift">
          <div className="flex items-center justify-between">
            <button className={arrow} onClick={() => setMonth((m) => addMonths(m, -1))} disabled={!canPrevMonth} aria-label="Previous month">
              <FiChevronLeft size={15} />
            </button>
            <span className="text-sm font-semibold">{month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</span>
            <button className={arrow} onClick={() => setMonth((m) => addMonths(m, 1))} disabled={!canNextMonth} aria-label="Next month">
              <FiChevronRight size={15} />
            </button>
          </div>
          <div className="mt-2 grid grid-cols-7 gap-0.5 text-center">
            {WEEKDAYS.map((w) => <div key={w} className="py-1 text-[11px] font-medium text-muted-foreground">{w}</div>)}
            {Array.from({ length: blanks }, (_, i) => <div key={`b${i}`} />)}
            {days.map((day) => {
              const ok = selectable(day);
              const selected = day === value;
              return (
                <button key={day} onClick={() => ok && pick(day)} disabled={!ok}
                        aria-label={parseDate(day).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
                        aria-pressed={selected}
                        className={cn(
                          "relative grid h-8 place-items-center rounded-lg text-sm transition-colors",
                          selected ? "bg-primary font-semibold text-primary-foreground"
                            : ok ? "text-foreground hover:bg-secondary" : "text-muted-foreground/40",
                          day === today && !selected && "ring-1 ring-primary/60",
                        )}>
                  {parseDate(day).getDate()}
                  {has.has(day) && !selected && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-primary/70" />}
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><span className="h-1 w-1 rounded-full bg-primary/70" /> days with visitors</span>
            <button onClick={() => pick(today)} className="rounded-full px-2 py-1 font-medium text-primary hover:bg-primary/10">Today</button>
          </div>
        </Card>
      )}
    </div>
  );
};
