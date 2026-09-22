"use client";

import React from "react";
import { Database, Server, Cpu, RefreshCw, CheckCircle2, AlertCircle, XCircle } from "lucide-react";
import { SystemHealth } from "@/types";

interface BackendStatusCardProps {
  health: SystemHealth | null;
  loading: boolean;
  onRefresh: () => void;
}

export const BackendStatusCard: React.FC<BackendStatusCardProps> = ({ health, loading, onRefresh }) => {
  const isBackendOnline = health?.status === "online" || health?.status === "degraded";
  const isDbConnected = health?.database?.connected;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur-md p-6 shadow-xl relative overflow-hidden">
      {/* Glow highlight */}
      <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />

      <div className="flex items-center justify-between pb-4 border-b border-slate-800/80 mb-6">
        <div>
          <h2 className="text-base font-semibold text-white flex items-center space-x-2">
            <Cpu className="w-4 h-4 text-indigo-400" />
            <span>Infrastructure Health Monitor</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Real-time telemetry across Frontend, Backend, and Database</p>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="p-2 rounded-lg border border-slate-800 bg-slate-950/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50 cursor-pointer"
          title="Refresh Health Status"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-indigo-400" : ""}`} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Next.js Node */}
        <div className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-4 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center">
                <span className="font-bold text-xs text-white">N</span>
              </div>
              <div>
                <h3 className="text-sm font-medium text-slate-200">Next.js 15</h3>
                <p className="text-xs text-slate-500">Frontend Layer</p>
              </div>
            </div>
            <span className="flex items-center space-x-1 text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
              <CheckCircle2 className="w-3 h-3" />
              <span>Active</span>
            </span>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-900 text-xs text-slate-400 space-y-1">
            <div className="flex justify-between">
              <span>Port:</span>
              <span className="font-mono text-slate-300">3000</span>
            </div>
            <div className="flex justify-between">
              <span>Router:</span>
              <span className="text-slate-300">App Router</span>
            </div>
          </div>
        </div>

        {/* Python FastAPI Node */}
        <div className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-4 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
                <Server className="w-4 h-4 text-sky-400" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-slate-200">Python FastAPI</h3>
                <p className="text-xs text-slate-500">Backend API</p>
              </div>
            </div>
            {isBackendOnline ? (
              <span className="flex items-center space-x-1 text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                <CheckCircle2 className="w-3 h-3" />
                <span>Connected</span>
              </span>
            ) : (
              <span className="flex items-center space-x-1 text-xs font-medium text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-full">
                <XCircle className="w-3 h-3" />
                <span>Offline</span>
              </span>
            )}
          </div>
          <div className="mt-4 pt-3 border-t border-slate-900 text-xs text-slate-400 space-y-1">
            <div className="flex justify-between">
              <span>Host / Port:</span>
              <span className="font-mono text-slate-300">127.0.0.1:8000</span>
            </div>
            <div className="flex justify-between">
              <span>OpenAPI:</span>
              <span className="text-indigo-400 font-mono">/docs</span>
            </div>
          </div>
        </div>

        {/* PostgreSQL Node */}
        <div className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-4 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                <Database className="w-4 h-4 text-indigo-400" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-slate-200">PostgreSQL</h3>
                <p className="text-xs text-slate-500">Database Engine</p>
              </div>
            </div>
            {isDbConnected ? (
              <span className="flex items-center space-x-1 text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                <CheckCircle2 className="w-3 h-3" />
                <span>Connected</span>
              </span>
            ) : isBackendOnline ? (
              <span className="flex items-center space-x-1 text-xs font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                <AlertCircle className="w-3 h-3" />
                <span>DB Pending</span>
              </span>
            ) : (
              <span className="flex items-center space-x-1 text-xs font-medium text-slate-400 bg-slate-800/50 border border-slate-700/50 px-2 py-0.5 rounded-full">
                <span>Waiting</span>
              </span>
            )}
          </div>
          <div className="mt-4 pt-3 border-t border-slate-900 text-xs text-slate-400 space-y-1">
            <div className="flex justify-between">
              <span>Port / Service:</span>
              <span className="font-mono text-slate-300">5432</span>
            </div>
            <div className="flex justify-between">
              <span>Database:</span>
              <span className="text-slate-300 font-mono">{health?.database?.database || "kpm_db"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Diagnostics / Error Callout if Database is not connected */}
      {health && !isDbConnected && isBackendOnline && (
        <div className="mt-4 p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/5 text-amber-300 text-xs">
          <div className="flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-400" />
            <div>
              <p className="font-semibold text-amber-200">Database Connection Notice:</p>
              <p className="text-slate-300 mt-1">{health.database?.message}</p>
              <p className="text-slate-400 mt-2">
                Tip: If database <code className="text-amber-300 font-mono">kpm_db</code> has not been created yet in PostgreSQL, you can create it via <code className="text-amber-300 font-mono">createdb -U postgres kpm_db</code> or update credentials in <code className="text-amber-300 font-mono">backend/.env</code>.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
