"use client";

import type { FormEvent } from "react";
import { Card } from "./Card";

const PROMPTS = [
  "Show me my low stock items",
  "What are my top selling products?",
  "Summarize my weekly performance",
  "Which products need reordering?",
];

export function AIAssistant({
  question,
  answer,
  loading,
  onQuestion,
  onAsk,
  onPrompt,
}: {
  question: string;
  answer: string | null;
  loading: boolean;
  onQuestion: (value: string) => void;
  onAsk: (event: FormEvent) => void;
  onPrompt: (prompt: string) => void;
}) {
  return (
    <Card className="border-[#dbe7ff] bg-[#f3f7ff] p-4 sm:p-5">
      <div data-tour="ai">
        <h2 className="text-[16px] font-semibold tracking-[-0.02em] text-[var(--app-ink)]">KPM AI Assistant</h2>
        <p className="mt-1 text-[13px] text-[var(--app-muted)]">Ask about stock, sales, and what to do next.</p>
        <div className="mt-4 rounded-[18px] bg-[var(--app-surface)] px-3.5 py-3 text-[13px] leading-5 text-[#334155] shadow-[0_8px_24px_rgba(59,108,255,0.08)]">
          {answer || "Your workspace answers show up here."}
        </div>
        {loading ? (
          <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-[#dbe7ff] bg-[var(--app-surface)] px-3 py-1.5 text-[12px] font-medium text-[#2563eb]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#4c8dff]" />
            Generating reply…
          </p>
        ) : null}
        <ul className="mt-3 space-y-1">
          {PROMPTS.map((prompt) => (
            <li key={prompt}>
              <button
                type="button"
                onClick={() => onPrompt(prompt)}
                className="w-full rounded-full px-2 py-1.5 text-left text-[13px] text-[var(--app-ink)] transition-colors duration-150 hover:bg-[var(--app-surface)]"
              >
                {prompt}
              </button>
            </li>
          ))}
        </ul>
        <form onSubmit={onAsk} className="mt-3 flex gap-2">
          <label className="sr-only" htmlFor="kpm-ai-question">
            Ask KPM AI
          </label>
          <input
            id="kpm-ai-question"
            value={question}
            onChange={(event) => onQuestion(event.target.value)}
            placeholder="Ask a question…"
            className="h-10 min-w-0 flex-1 rounded-full border border-[var(--app-border-strong)] bg-[var(--app-surface)] px-3.5 text-[13px] text-[var(--app-ink)] outline-none placeholder:text-[var(--app-faint)] transition-[border-color,box-shadow] duration-160 focus:border-[var(--app-accent)] focus:shadow-[var(--app-focus-ring)]"
          />
          <button
            type="submit"
            disabled={loading || !question.trim()}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--app-nav-active-bg)] text-[var(--app-nav-active)] shadow-[var(--app-shadow-xs)] transition-opacity duration-160 hover:opacity-90 disabled:opacity-40"
            aria-label="Send question"
          >
            →
          </button>
        </form>
      </div>
    </Card>
  );
}
