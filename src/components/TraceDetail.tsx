"use client";

import { useEffect, useState } from "react";
import { fetchTrace } from "@/lib/api";
import type { Trace, TraceSummary } from "@/lib/types";
import { CloseIcon, StatusSuccessIcon, StatusErrorIcon } from "./nl/icons";

/** Span-kind chips, tinted from their chart ramp rather than raw Tailwind hues. */
const KIND = {
    agent_action: "bg-[#514b8c]/10 text-[#514b8c]",
    chain: "bg-sky-600/10 text-sky-700",
    tool_call: "bg-amber-600/10 text-amber-700",
    retrieval: "bg-teal-600/10 text-teal-700",
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
            <div key={s.span_id} style={{ marginLeft: depth * 14 }} className="border-l border-border py-1.5 pl-3">
                <div className="flex items-center gap-2">
                    <span className={`rounded px-1.5 py-0.5 text-2xs font-medium ${KIND[s.node_type]}`}>{s.node_type}</span>
                    <span className="truncate text-xs text-foreground/85">{s.node_name}</span>
                    <span className="ml-auto shrink-0 font-mono text-2xs tabular-nums text-muted-foreground/70">
                        {s.data.duration_ms.toFixed(0)}ms
                    </span>
                </div>
                {s.data.output_value && (
                    <pre className="mt-1 max-h-32 overflow-auto rounded-md border border-border bg-surface-subtle p-2 font-mono text-2xs leading-relaxed whitespace-pre-wrap text-muted-foreground">
                        {s.data.output_value.slice(0, 600)}
                        {s.output_truncated ? "\n… truncated by the server" : ""}
                    </pre>
                )}
                {render(s.span_id, depth + 1)}
            </div>
        ));

    return (
        <aside className="flex w-[440px] shrink-0 flex-col border-l border-border bg-background">
            <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
                <div className="flex min-w-0 items-center gap-2">
                    {summary.status === "success"
                        ? <StatusSuccessIcon className="size-4 shrink-0 text-success" />
                        : <StatusErrorIcon className="size-4 shrink-0 text-destructive" />}
                    <div className="min-w-0">
                        <div className="truncate text-[13px] text-foreground">{summary.name}</div>
                        <div className="truncate font-mono text-2xs text-muted-foreground/70">
                            #{summary.id} · {summary._id.slice(0, 16)}…
                        </div>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    aria-label="Close"
                    className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                    <CloseIcon className="size-4" />
                </button>
            </header>
            <div className="grid grid-cols-3 border-b border-border">
                {([["latency", `${summary.latency}ms`],
                   ["tokens", summary.totalTokensUsed.toLocaleString()],
                   ["cost", `$${summary.totalTokensCost.toFixed(4)}`]] as const).map(([k, v]) => (
                    <div key={k} className="border-r border-border px-3 py-2 last:border-r-0">
                        <div className="text-2xs uppercase text-muted-foreground/70">{k}</div>
                        <div className="font-mono text-xs tabular-nums text-foreground/85">{v}</div>
                    </div>
                ))}
            </div>
            <div className="nl-scroll flex-1 overflow-auto p-3">
                {error && <div className="text-xs text-destructive">{error}</div>}
                {!trace && !error && <div className="text-xs text-muted-foreground">Fetching spans…</div>}
                {trace && render(undefined, 0)}
            </div>
        </aside>
    );
}
