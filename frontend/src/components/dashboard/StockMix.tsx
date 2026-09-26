import { Card, CardHeader } from "./Card";

export function StockMix({
  inStock,
  low,
  out,
}: {
  inStock: number;
  low: number;
  out: number;
}) {
  const total = inStock + low + out;
  const slices = [
    { label: "In stock", value: inStock, color: "#4c8dff" },
    { label: "Low", value: low, color: "#ff9f2f" },
    { label: "Out", value: out, color: "#e2e8f0" },
  ];
  let cursor = 0;
  const stops = total
    ? slices
        .map((slice) => {
          const start = cursor;
          cursor += (slice.value / total) * 100;
          return `${slice.color} ${start}% ${cursor}%`;
        })
        .join(", ")
    : "#eef2f7 0% 100%";

  return (
    <Card className="p-4 sm:p-5">
      <CardHeader title="Stock mix" />
      <div className="mt-4 flex items-center gap-5">
        <div
          className="relative h-28 w-28 shrink-0 rounded-full"
          style={{ background: `conic-gradient(${stops})` }}
          role="img"
          aria-label={total ? `${inStock} in stock, ${low} low, ${out} out of stock` : "No products yet"}
        >
          <div className="absolute inset-[18px] flex items-center justify-center rounded-full bg-[var(--app-surface)]">
            <div className="text-center">
              <div className="text-[20px] font-bold leading-none tracking-[-0.03em] text-[#0f172a]">{total}</div>
              <div className="mt-1 text-[11px] text-[#94a3b8]">Products</div>
            </div>
          </div>
        </div>
        <ul className="min-w-0 space-y-2 text-[13px]">
          {slices.map((slice) => (
            <li key={slice.label} className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 text-[#64748b]">
                <span className="h-2 w-2 rounded-full" style={{ background: slice.color }} />
                {slice.label}
              </span>
              <span className="font-semibold tabular-nums text-[#0f172a]">
                {total ? Math.round((slice.value / total) * 100) : 0}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
