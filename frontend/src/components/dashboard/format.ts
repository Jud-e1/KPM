export function formatCurrency(amount: number, digits = 2) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function compactCurrency(amount: number) {
  const value = Number.isFinite(amount) ? amount : 0;
  const abs = Math.abs(value);
  if (abs >= 1000) {
    const scaled = value / 1000;
    const digits = abs >= 10000 ? 0 : 1;
    return `$${scaled.toFixed(digits)}k`;
  }
  return `$${Math.round(value)}`;
}

export function greetingFor(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function firstName(fullName: string) {
  const cleaned = fullName.trim();
  if (!cleaned || cleaned === "KPM User") return "";
  return cleaned.split(/\s+/)[0] || "";
}

export function formatLongDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function formatTime(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}
