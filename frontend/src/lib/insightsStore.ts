/** Empty-first insights store — reports and chat from real usage only. */

import {
  readScopedJson,
  removeScopedJson,
  writeScopedJson,
} from "@/lib/storePersistence";

export type InsightTone = "demand" | "warning" | "fraud" | "success" | "info";

export interface InsightItem {
  id: string;
  title: string;
  description: string;
  tone: InsightTone;
  timestamp: number;
}

export interface AiChatMessage {
  id: string;
  role: "assistant" | "user";
  content: string;
  timestamp: number;
}

export interface AiReport {
  id: string;
  title: string;
  period: string;
  generatedAt: string;
  format: "PDF" | "CSV";
}

export interface ForecastPoint {
  label: string;
  day: number;
  actual: number | null;
  predicted: number;
}

export interface StockMovementPoint {
  label: string;
  inflow: number;
  outflow: number;
}

export interface InsightsState {
  messages: AiChatMessage[];
  reports: AiReport[];
  lastQuery: string;
  lastSync: string;
}

const STORAGE_KEY = "kpm_insights_state_v2";
const SYNC_CHANNEL_NAME = "kpm_insights_sync_channel";

function defaultGreeting(firstName: string): AiChatMessage {
  const name = firstName.trim() || "there";
  return {
    id: "msg-welcome",
    role: "assistant",
    content: `Hi ${name}! I'm your AI assistant. Ask me about sales, inventory, or finances.`,
    timestamp: Date.now(),
  };
}

class InsightsStore {
  private state: InsightsState;
  private listeners = new Set<(state: InsightsState) => void>();
  private broadcastChannel: BroadcastChannel | null = null;
  private persistTimer: number | null = null;

  constructor() {
    this.state = this.loadState();
    if (typeof window !== "undefined") {
      try {
        this.broadcastChannel = new BroadcastChannel(SYNC_CHANNEL_NAME);
        this.broadcastChannel.onmessage = (event) => {
          if (event.data?.type === "INSIGHTS_UPDATE") {
            this.state = event.data.state;
            this.notify(false);
          }
        };
      } catch {}
      window.addEventListener("storage", (event) => {
        if (!event.key?.startsWith(`${STORAGE_KEY}:`) || !event.newValue) return;
        if (this.ownerId && event.key !== `${STORAGE_KEY}:${this.ownerId}`) return;
        try {
          this.state = JSON.parse(event.newValue);
          this.notify(false);
        } catch {}
      });
    }
  }

  private ownerId: string | null = null;

  public bindOwner(userId: string) {
    if (this.ownerId === userId) return;
    this.ownerId = userId;
    this.state = this.loadStateFor(userId);
    this.notify();
  }

  private loadState(): InsightsState {
    return {
      messages: [defaultGreeting("there")],
      reports: [],
      lastQuery: "",
      lastSync: new Date().toISOString(),
    };
  }

  private loadStateFor(userId: string): InsightsState {
    const parsed = readScopedJson<InsightsState>(STORAGE_KEY, userId);
    if (parsed && Array.isArray(parsed.messages)) {
      return {
        ...parsed,
        reports: Array.isArray(parsed.reports) ? parsed.reports : [],
        lastSync: parsed.lastSync || new Date().toISOString(),
      };
    }
    return this.loadState();
  }

  private notify(broadcast = true) {
    this.listeners.forEach((listener) => listener(this.state));
    if (broadcast && typeof window !== "undefined") {
      try {
        this.broadcastChannel?.postMessage({ type: "INSIGHTS_UPDATE", state: this.state });
        if (this.persistTimer !== null) window.clearTimeout(this.persistTimer);
        this.persistTimer = window.setTimeout(() => {
          writeScopedJson(STORAGE_KEY, this.ownerId, this.state);
        }, 120);
      } catch {}
    }
  }

  private commit(next: InsightsState) {
    this.state = { ...next, lastSync: new Date().toISOString() };
    this.notify();
  }

  public getState() {
    return this.state;
  }

  public subscribe(listener: (state: InsightsState) => void) {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  public ensureGreeting(firstName: string) {
    const welcome = this.state.messages.find((message) => message.id === "msg-welcome");
    if (!welcome) {
      this.commit({
        ...this.state,
        messages: [defaultGreeting(firstName), ...this.state.messages],
      });
      return;
    }
    const nextContent = defaultGreeting(firstName).content;
    if (welcome.content === nextContent) return;
    this.commit({
      ...this.state,
      messages: this.state.messages.map((message) =>
        message.id === "msg-welcome" ? { ...message, content: nextContent } : message
      ),
    });
  }

  public ask(question: string, answer: string) {
    const trimmed = question.trim();
    if (!trimmed) return;
    const now = Date.now();
    const userMessage: AiChatMessage = { id: `user-${now}`, role: "user", content: trimmed, timestamp: now };
    const assistantMessage: AiChatMessage = {
      id: `assistant-${now + 1}`,
      role: "assistant",
      content: answer,
      timestamp: now + 1,
    };
    this.commit({
      ...this.state,
      lastQuery: trimmed,
      messages: [...this.state.messages, userMessage, assistantMessage].slice(-24),
    });
  }

  public exportReportCsv(report: AiReport, rows: string[][]) {
    const header = ["Report", "Period", "Generated"];
    const meta = [report.title, report.period, report.generatedAt];
    const body = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","));
    return [header.join(","), meta.map((cell) => `"${cell}"`).join(","), "", ...body].join("\n");
  }

  public resetToDefault() {
    removeScopedJson(STORAGE_KEY, this.ownerId);
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {}
    }
    this.ownerId = null;
    this.state = {
      messages: [defaultGreeting("there")],
      reports: [],
      lastQuery: "",
      lastSync: new Date().toISOString(),
    };
    this.notify();
  }
}

export const insightsStore = new InsightsStore();

/** Build a daily series from dated revenue points; empty when under 2 days of history. */
export function buildForecastSeriesFromDaily(
  dailyRevenue: Array<{ dayKey: string; label: string; amount: number }>
): ForecastPoint[] {
  if (dailyRevenue.length < 2) return [];
  const sorted = [...dailyRevenue].sort((a, b) => a.dayKey.localeCompare(b.dayKey));
  const values = sorted.map((d) => d.amount);
  const avg = values.reduce((s, v) => s + v, 0) / values.length;
  return sorted.map((d, index) => {
    const trail = values.slice(Math.max(0, index - 2), index + 1);
    const localAvg = trail.reduce((s, v) => s + v, 0) / trail.length;
    return {
      label: d.label,
      day: index + 1,
      actual: d.amount,
      predicted: Number((localAvg * 0.7 + avg * 0.3).toFixed(0)),
    };
  });
}

/** @deprecated Prefer buildForecastSeriesFromDaily with real order dates */
export function buildForecastSeries(totalRevenue: number): ForecastPoint[] {
  if (totalRevenue <= 0) return [];
  const base = totalRevenue / 30;
  const points: ForecastPoint[] = [];
  for (let day = 1; day <= 14; day += 1) {
    points.push({
      label: `Day ${day}`,
      day,
      actual: Number((base * (0.85 + day / 100)).toFixed(0)),
      predicted: Number((base * (0.9 + day / 90)).toFixed(0)),
    });
  }
  return points;
}

export function buildStockMovementFromProducts(
  products: Array<{ stock: number; lowStockThreshold?: number }>
): StockMovementPoint[] {
  if (!products.length) return [];
  const low = products.filter((p) => p.lowStockThreshold != null && p.stock <= (p.lowStockThreshold || 0)).length;
  const healthy = products.length - low;
  return [
    { label: "Healthy stock", inflow: healthy, outflow: 0 },
    { label: "Low / watch", inflow: 0, outflow: low },
  ];
}

/** @deprecated Prefer buildStockMovementFromProducts */
export function buildStockMovement(lowStockCount: number, totalProducts: number): StockMovementPoint[] {
  if (totalProducts <= 0) return [];
  return [
    { label: "In range", inflow: Math.max(0, totalProducts - lowStockCount), outflow: 0 },
    { label: "Low stock", inflow: 0, outflow: lowStockCount },
  ];
}
