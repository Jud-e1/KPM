"use client";

import React from "react";
import { Database, Server, Layers, ExternalLink, Activity, Terminal } from "lucide-react";
import { SystemHealth } from "@/types";

interface HeaderProps {
  health: SystemHealth | null;
  loading: boolean;
  onRefreshHealth: () => void;
}

export const Header: React.FC<HeaderProps> = ({ health, loading, onRefreshHealth }) => {
  const isOnline = health?.status === "online";
  const isDegraded = health?.status === "degraded";

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/25">
            <Layers className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                KPM Full-Stack
              </span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-400">
                Next.js + Python + Postgres
              </span>
            </div>
            <p className="text-xs text-[var(--app-faint)]">Next.js 15 • FastAPI 0.115 • PostgreSQL 18</p>
          </div>
        </div>

        {/* Action badges & Health indicator */}
        <div className="flex items-center space-x-3">
          <button
            onClick={onRefreshHealth}
            title="Check backend & database health"
            className="flex items-center space-x-2 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-800/80 hover:border-slate-700 text-xs font-medium text-slate-300 transition-all cursor-pointer"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                loading
                  ? "bg-amber-400 animate-ping"
                  : isOnline
                  ? "bg-emerald-400 shadow-sm shadow-emerald-400/50"
                  : isDegraded
                  ? "bg-amber-400 shadow-sm shadow-amber-400/50"
                  : "bg-rose-500 shadow-sm shadow-rose-500/50"
              }`}
            />
            <span className="capitalize">
              {loading ? "Checking..." : isOnline ? "Stack Online" : isDegraded ? "DB Pending" : "Offline"}
            </span>
          </button>

          <a
            href="http://127.0.0.1:8000/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 text-xs font-medium transition-all"
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>FastAPI Docs</span>
            <ExternalLink className="w-3 h-3 ml-0.5 opacity-70" />
          </a>
        </div>
      </div>
    </header>
  );
};
