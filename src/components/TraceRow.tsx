"use client";

import type { TraceSummary } from "@/lib/types";

const STATUS = {
    success: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
    error: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
} as const;

export function TraceRow({ trace, onOpen }: { trace: TraceSummary; onOpen: (t: TraceSummary) => void }) {
    return (
        <button
            onClick={() => onOpen(trace)}
            className="flex w-full items-center gap-3 border-b border-white/5 px-4 py-2.5 text-left transition-colors hover:bg-white/5"
        >
            <span className="w-16 shrink-0 font-mono text-[11px] text-white/30">#{trace.id}</span>
            <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ring-1 ${STATUS[trace.status]}`}>
                {trace.status}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm text-white/90">{trace.name}</span>
            <span className="hidden shrink-0 font-mono text-[11px] text-white/40 sm:inline">
                {trace.spanCount} spans
            </span>
            <span className="hidden shrink-0 font-mono text-[11px] text-white/40 md:inline">
                {trace.totalTokensUsed.toLocaleString()} tok
            </span>
            <span className="w-16 shrink-0 text-right font-mono text-[11px] text-white/50">
                {trace.latency < 1000 ? `${trace.latency}ms` : `${(trace.latency / 1000).toFixed(1)}s`}
            </span>
        </button>
    );
}
