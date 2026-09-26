export function Sparkline({
  values,
  tone = "accent",
}: {
  values: number[];
  tone?: "accent" | "warning";
}) {
  if (values.length < 2) {
    return <div className="h-10 w-[72px] shrink-0" aria-hidden />;
  }

  const width = 72;
  const height = 36;
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const span = Math.max(max - min, 1);
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * (width - 4) + 2;
      const y = 4 + (1 - (value - min) / span) * (height - 8);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const color = tone === "warning" ? "#b42318" : "#4454c8";

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="shrink-0" aria-hidden>
      <polyline fill="none" stroke={color} strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round" points={points} />
    </svg>
  );
}
