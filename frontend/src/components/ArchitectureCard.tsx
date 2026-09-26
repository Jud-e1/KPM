"use client";

import React, { useState } from "react";
import { Terminal, Copy, Check, Code2, Database, Globe, ArrowRight, ShieldCheck } from "lucide-react";

export const ArchitectureCard: React.FC = () => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const snippets = [
    {
      title: "Launch Both Servers (PowerShell)",
      cmd: ".\\run-all.ps1",
    },
    {
      title: "Start Python Backend Server",
      cmd: "cd backend; .\\.venv\\Scripts\\python.exe -m uvicorn app.main:app --reload --port 8000",
    },
    {
      title: "Start Next.js Frontend Server",
      cmd: "cd frontend; npm run dev",
    },
    {
      title: "Start PostgreSQL in Docker (Alternative)",
      cmd: "docker compose up -d postgres",
    },
  ];

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur-md p-6 shadow-xl space-y-6">
      <div className="flex items-center space-x-2 pb-4 border-b border-slate-800/80">
        <Code2 className="w-5 h-5 text-indigo-400" />
        <h2 className="text-base font-semibold text-white">Full-Stack Architecture & Quick Commands</h2>
      </div>

      {/* Visual Pipeline */}
      <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
        <div className="flex items-center space-x-3 w-full md:w-auto">
          <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <div className="font-semibold text-slate-200">Next.js 15 Client</div>
            <div className="text-[var(--app-muted)]">React 19 • App Router • Port 3000</div>
          </div>
        </div>

        <ArrowRight className="w-4 h-4 text-[var(--app-muted)] hidden md:block" />

        <div className="flex items-center space-x-3 w-full md:w-auto">
          <div className="w-9 h-9 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
            <Terminal className="w-5 h-5" />
          </div>
          <div>
            <div className="font-semibold text-slate-200">Python FastAPI</div>
            <div className="text-[var(--app-muted)]">Async REST API • Port 8000</div>
          </div>
        </div>

        <ArrowRight className="w-4 h-4 text-[var(--app-muted)] hidden md:block" />

        <div className="flex items-center space-x-3 w-full md:w-auto">
          <div className="w-9 h-9 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <div className="font-semibold text-slate-200">PostgreSQL 18</div>
            <div className="text-[var(--app-muted)]">SQLAlchemy ORM • Port 5432</div>
          </div>
        </div>
      </div>

      {/* Command snippets */}
      <div className="space-y-3">
        <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Quick Commands</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {snippets.map((snip, idx) => (
            <div
              key={idx}
              className="p-3 rounded-xl border border-slate-800 bg-slate-950/40 flex flex-col justify-between"
            >
              <div className="text-[11px] font-medium text-[var(--app-faint)] mb-1.5">{snip.title}</div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950 border border-slate-900 font-mono text-[11px] text-indigo-300">
                <span className="truncate pr-2">{snip.cmd}</span>
                <button
                  onClick={() => handleCopy(snip.cmd, idx)}
                  className="p-1 rounded hover:bg-slate-800 text-[var(--app-faint)] hover:text-slate-200 transition-colors cursor-pointer flex-shrink-0"
                  title="Copy command"
                >
                  {copiedIndex === idx ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
