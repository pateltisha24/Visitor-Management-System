import { FiArrowUp, FiArrowDown } from "react-icons/fi";
import { Card } from "../ui/card";

// Building blocks shared by the dashboard's charts.

export const num = (n) => (n ?? 0).toLocaleString();

export const CustomTooltip = ({ active, payload, label, labelFormatter }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-card/95 px-3 py-2 text-xs shadow-lift backdrop-blur">
      {label != null && <div className="mb-1 font-medium text-foreground">{labelFormatter ? labelFormatter(label) : label}</div>}
      {payload.filter((p) => p.value != null).map((p) => (
        <div key={p.name} className="flex items-center gap-2 text-muted-foreground">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color || p.payload?.fill }} />
          <span>{p.name}</span>
          <span className="ml-auto font-mono text-foreground">{num(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

export const Delta = ({ value, unit = "%" }) => {
  if (value == null) return null;
  const up = value >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium ${up ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-red-500/10 text-red-600 dark:text-red-400"}`}>
      {up ? <FiArrowUp size={11} /> : <FiArrowDown size={11} />}{Math.abs(value)}{unit}
    </span>
  );
};

export const ChartCard = ({ title, description, action, children, className = "" }) => (
  <Card className={`p-6 ${className}`}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 className="text-base font-semibold">{title}</h3>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
    <div className="mt-5">{children}</div>
  </Card>
);
