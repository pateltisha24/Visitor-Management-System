// Stable color per emotion (maps onto the CSS chart palette).
export const EMOTION_COLORS = {
  Happy: "hsl(var(--chart-3))",
  Neutral: "hsl(var(--chart-5))",
  Surprise: "hsl(var(--chart-7))",
  Sad: "hsl(var(--chart-2))",
  Fear: "hsl(var(--chart-4))",
  Angry: "hsl(var(--chart-1))",
  Disgust: "hsl(var(--chart-6))",
};

export const emotionColor = (name) =>
  EMOTION_COLORS[name] || EMOTION_COLORS[name?.[0]?.toUpperCase() + name?.slice(1)] || "hsl(var(--chart-1))";

export const GENDER_COLORS = {
  Female: "hsl(var(--primary))",
  Male: "hsl(var(--chart-5))",
};

// Recharts axis/grid styling shared across charts.
export const axisProps = {
  tick: { fill: "hsl(var(--muted-foreground))", fontSize: 12 },
  tickLine: false,
  axisLine: { stroke: "hsl(var(--border))" },
};
