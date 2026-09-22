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

const STORAGE_KEY = "kpm_insights_state_v1";
const SYNC_CHANNEL_NAME = "kpm_insights_sync_channel";

const DEFAULT_REPORTS: AiReport[] = [
  { id: "rpt-1", title: "Sales Performance Summary", period: "Apr 1 – Apr 30, 2025", generatedAt: "Apr 30, 2025", format: "PDF" },
  { id: "rpt-2", title: "Inventory Health Report", period: "Apr 1 – Apr 30, 2025", generatedAt: "Apr 29, 2025", format: "PDF" },
  { id: "rpt-3", title: "Profit & Loss Analysis", period: "Apr 1 – Apr 30, 2025", generatedAt: "Apr 28, 2025", format: "CSV" },
  { id: "rpt-4", title: "Supplier Performance Review", period: "Apr 1 – Apr 30, 2025", generatedAt: "Apr 27, 2025", format: "PDF" },
];

function defaultGreeting(firstName: string): AiChatMessage {
  return {
    id: "msg-welcome",
    role: "assistant",
    content: `Hi ${firstName}! I'm your AI assistant. Ask me about sales, inventory, or finances.`,
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
        if (event.key === STORAGE_KEY && event.newValue) {
          try {
            this.state = JSON.parse(event.newValue);
            this.notify(false);
          } catch {}
        }
      });
    }
  }

  private loadState(): InsightsState {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as InsightsState;
          if (parsed.messages?.length) {
            return {
              ...parsed,
              reports: parsed.reports?.length ? parsed.reports : DEFAULT_REPORTS,
              lastSync: parsed.lastSync || new Date().toISOString(),
            };
          }
        }
      } catch {}
    }
    return {
      messages: [defaultGreeting("Jude")],
      reports: DEFAULT_REPORTS,
      lastQuery: "",
      lastSync: new Date().toISOString(),
    };
  }

  private notify(broadcast = true) {
    this.listeners.forEach((listener) => listener(this.state));
    if (broadcast && typeof window !== "undefined") {
      try {
        this.broadcastChannel?.postMessage({ type: "INSIGHTS_UPDATE", state: this.state });
        if (this.persistTimer !== null) window.clearTimeout(this.persistTimer);
        this.persistTimer = window.setTimeout(() => {
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
          } catch {}
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
    const nextContent = `Hi ${firstName}! I'm your AI assistant. Ask me about sales, inventory, or finances.`;
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
    const assistantMessage: AiChatMessage = { id: `assistant-${now + 1}`, role: "assistant", content: answer, timestamp: now + 1 };
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
}

export const insightsStore = new InsightsStore();

export function buildForecastSeries(totalRevenue: number): ForecastPoint[] {
  const base = Math.max(1200, totalRevenue / 30);
  const points: ForecastPoint[] = [];
  for (let day = 1; day <= 30; day += 1) {
    const wave = Math.sin(day / 4.2) * 0.18 + Math.cos(day / 7.5) * 0.08;
    const actual = day <= 27 ? Number((base * (0.82 + wave + day / 180)).toFixed(0)) : null;
    const predicted = Number((base * (0.9 + wave + day / 150)).toFixed(0));
    points.push({
      label: `Apr ${day}`,
      day,
      actual,
      predicted,
    });
  }
  return points;
}

export function buildStockMovement(lowStockCount: number, totalProducts: number): StockMovementPoint[] {
  const labels = ["Apr 1", "Apr 5", "Apr 10", "Apr 15", "Apr 20", "Apr 25", "Apr 28"];
  return labels.map((label, index) => {
    const inflow = 18 + ((index * 7 + lowStockCount) % 22);
    const outflow = 12 + ((index * 5 + totalProducts) % 20);
    return { label, inflow, outflow };
  });
}
