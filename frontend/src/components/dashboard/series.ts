export type RangeKey = "7d" | "30d" | "90d" | "custom";

export type SeriesPoint = {
  label: string;
  value: number;
  sort: string;
};

export type OrderLike = {
  timestamp: number;
  totalAmount: number;
  status: string;
};

export function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export function dayKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function rangeBounds(range: RangeKey, customStart: string, customEnd: string, now = new Date()) {
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  if (range === "30d") start.setDate(start.getDate() - 29);
  else if (range === "90d") start.setDate(start.getDate() - 89);
  else if (range === "custom") {
    const parsedStart = customStart ? new Date(`${customStart}T00:00:00`) : new Date(start);
    const parsedEnd = customEnd ? new Date(`${customEnd}T23:59:59`) : new Date(end);
    if (Number.isNaN(parsedStart.getTime()) || Number.isNaN(parsedEnd.getTime())) {
      return { start, end };
    }
    if (parsedStart.getTime() > parsedEnd.getTime()) return { start: parsedEnd, end: parsedStart };
    return { start: parsedStart, end: parsedEnd };
  } else {
    start.setDate(start.getDate() - 6);
  }

  return { start, end };
}

export function rangeLabel(range: RangeKey) {
  if (range === "30d") return "the last 30 days";
  if (range === "90d") return "the last 90 days";
  if (range === "custom") return "the selected dates";
  return "the last 7 days";
}

export function rangeDays(range: RangeKey, customStart: string, customEnd: string) {
  if (range === "30d") return 30;
  if (range === "90d") return 90;
  if (range === "custom") {
    const { start, end } = rangeBounds(range, customStart, customEnd);
    return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000));
  }
  return 7;
}

export function dailyOrderSeries(orders: OrderLike[], start: Date, end: Date, mode: "amount" | "count"): SeriesPoint[] {
  const totals = new Map<string, number>();
  const startMs = start.getTime();
  const endMs = end.getTime();

  for (const order of orders) {
    if (order.status === "Cancelled" || !order.timestamp) continue;
    if (order.timestamp < startMs || order.timestamp > endMs) continue;
    const key = dayKey(new Date(order.timestamp));
    const next = mode === "count" ? 1 : order.totalAmount;
    totals.set(key, (totals.get(key) || 0) + next);
  }

  const points: SeriesPoint[] = [];
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  const last = new Date(end);
  last.setHours(0, 0, 0, 0);

  while (cursor.getTime() <= last.getTime() && points.length < 120) {
    const sort = dayKey(cursor);
    const label = new Intl.DateTimeFormat("en-US", {
      month: points.length > 14 ? "numeric" : "short",
      day: "numeric",
    }).format(cursor);
    const raw = totals.get(sort) || 0;
    points.push({
      label,
      sort,
      value: mode === "count" ? raw : Math.round(raw * 100) / 100,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return points;
}

export function trailingChange(orders: OrderLike[], days: number, now = Date.now()) {
  const span = Math.max(1, days) * 86400000;
  let current = 0;
  let previous = 0;
  let currentCount = 0;
  let previousCount = 0;

  for (const order of orders) {
    if (order.status === "Cancelled" || !order.timestamp) continue;
    if (order.timestamp >= now - span && order.timestamp <= now) {
      current += order.totalAmount;
      currentCount += 1;
    } else if (order.timestamp >= now - span * 2 && order.timestamp < now - span) {
      previous += order.totalAmount;
      previousCount += 1;
    }
  }

  return {
    current,
    previous,
    currentCount,
    previousCount,
    delta: percentChange(current, previous),
    countDelta: percentChange(currentCount, previousCount),
  };
}
