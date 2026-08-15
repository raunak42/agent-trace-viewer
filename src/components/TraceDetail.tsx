"use client";

import { useEffect, useState } from "react";
import { fetchTrace } from "@/lib/api";
import type { Trace, TraceSummary } from "@/lib/types";

const KIND = {
    agent_action: "text-violet-300 bg-violet-500/10",
    chain: "text-sky-300 bg-sky-500/10",
    tool_call: "text-amber-300 bg-amber-500/10",
    retrieval: "text-teal-300 bg-teal-500/10",
} as const;

/** Spans are fetched here, on open — never as part of the list payload. */
export function TraceDetail({ summary, view, onClose }: {
    summary: TraceSummary | null;
    view: "naive" | "optimized";
    onClose: () => void;
}) {
    const [trace, setTrace] = useState<Trace | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!summary) { setTrace(null); setError(null); return; }
        let cancelled = false;
        setTrace(null); setError(null);
        fetchTrace(summary._id, view)
            .then((t) => { if (!cancelled) setTrace(t); })
            .catch((e) => { if (!cancelled) setError(String(e.message ?? e)); });
        return () => { cancelled = true; };
    }, [summary, view]);

    if (!summary) return null;

    // parent_span_id links the flat list into a tree; the root has none.
    const byParent = new Map<string | undefined, Trace["spans"]>();
    for (const s of trace?.spans ?? []) {
        const key = s.parent_span_id;
        if (!byParent.has(key)) byParent.set(key, []);
        byParent.get(key)!.push(s);
    }
    const render = (parent: string | undefined, depth: number): React.ReactNode =>
        (byParent.get(parent) ?? []).map((s) => (
            <div key={s.span_id} style={{ marginLeft: depth * 16 }} className="border-l border-white/10 pl-3 py-1.5">
                <div className="flex items-center gap-2">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] ${KIND[s.node_type]}`}>{s.node_type}</span>
                    <span className="truncate text-xs text-white/80">{s.node_name}</span>
                    <span className="ml-auto shrink-0 font-mono text-[10px] text-white/40">
                        {s.data.duration_ms.toFixed(0)}ms
                    </span>
                </div>
                {s.data.output_value && (
                    <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap rounded bg-black/40 p-2 font-mono text-[10px] leading-relaxed text-white/50">
                        {s.data.output_value.slice(0, 600)}
                        {s.output_truncated ? "\n… truncated by the server" : ""}
                    </pre>
                )}
                {render(s.span_id, depth + 1)}
            </div>
        ));

    return (
        <aside className="flex w-[440px] shrink-0 flex-col border-l border-white/10 bg-[#0d1117]">
            <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <div className="min-w-0">
                    <div className="truncate text-sm text-white/90">{summary.name}</div>
                    <div className="font-mono text-[10px] text-white/35">#{summary.id} · {summary._id.slice(0, 16)}…</div>
                </div>
                <button onClick={onClose} className="rounded px-2 py-1 text-white/40 hover:bg-white/10 hover:text-white/80">✕</button>
            </header>
            <div className="grid grid-cols-3 gap-px border-b border-white/10 bg-white/5 text-center">
                {[["latency", `${summary.latency}ms`], ["tokens", summary.totalTokensUsed.toLocaleString()], ["cost", `$${summary.totalTokensCost.toFixed(4)}`]]
                    .map(([k, v]) => (
                        <div key={k} className="bg-[#0d1117] px-2 py-2">
                            <div className="text-[10px] uppercase text-white/35">{k}</div>
                            <div className="font-mono text-xs text-white/80">{v}</div>
                        </div>
                    ))}
            </div>
            <div className="flex-1 overflow-auto p-3">
                {error && <div className="text-xs text-rose-300">{error}</div>}
                {!trace && !error && <div className="text-xs text-white/40">Fetching spans…</div>}
                {trace && render(undefined, 0)}
            </div>
        </aside>
    );
}
