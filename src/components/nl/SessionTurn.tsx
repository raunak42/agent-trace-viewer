"use client";

import { useState } from "react";
import type { Span, TraceSummary } from "@/lib/types";
import { ChevronDownIcon, ChevronRightIcon } from "./icons";

/* Node-type glyphs, drawn in their 24×24 / 1.5-stroke idiom. */
const NodeIcon = ({ type }: { type: Span["node_type"] }) => {
    const p = { xmlns: "http://www.w3.org/2000/svg", width: 24, height: 24, viewBox: "0 0 24 24",
                fill: "none", stroke: "currentColor", strokeWidth: 1.5, className: "size-4 shrink-0",
                strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
    switch (type) {
        case "agent_action":
            return <svg {...p}><path d="M12 2v3M6.5 8h11a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z" /><path d="M9.5 13h.01M14.5 13h.01" /></svg>;
        case "chain":
            return <svg {...p}><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" /></svg>;
        case "tool_call":
            return <svg {...p}><path d="M14.7 6.3a4 4 0 0 1 5.3 5L14 17.3a4 4 0 0 1-5.6-5.6" /><path d="M9.3 17.7 4 23M6 3l2.5 2.5M3 6l2.5 2.5" /></svg>;
        default:
            return <svg {...p}><path d="M19 11a8 8 0 1 0-16 0 8 8 0 0 0 16 0ZM17 17l4 4" /></svg>;
    }
};

const TYPE_LABEL: Record<Span["node_type"], string> = {
    agent_action: "AGENT", chain: "CHAIN", tool_call: "TOOL", retrieval: "RETRIEVAL",
};

const dur = (ms: number) => (ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`);

/** One node plus its subtree. `all` stays the complete span list so the
 *  recursion can find grandchildren, not just immediate kids. */
function SpanNodeTree({ span, all, depth, expandAll }: {
    span: Span; all: Span[]; depth: number; expandAll: boolean;
}) {
    const [open, setOpen] = useState(false);
    const kids = all.filter((s) => s.parent_span_id === span.span_id);
    const d = span.data;
    const hasDetail = Boolean(d.input_value || d.output_value || d.error_message);
    const expandable = kids.length > 0 || hasDetail;
    const showBody = expandAll || open;

    return (
        <div className="relative" style={{ paddingLeft: depth === 0 ? 0 : 26 }}>
            {depth > 0 && (
                <>
                    <span className="absolute top-0 left-[8px] h-[21px] w-px bg-border" aria-hidden />
                    <span className="absolute top-[21px] left-[8px] h-px w-[12px] bg-border" aria-hidden />
                </>
            )}
            <div className="flex items-center gap-2.5 py-2">
                <button
                    type="button"
                    onClick={() => setOpen((o) => !o)}
                    disabled={!expandable}
                    className={`z-10 flex size-[18px] shrink-0 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:bg-muted ${
                        expandable ? "" : "opacity-0"
                    }`}
                    aria-label={showBody ? "Collapse" : "Expand"}
                >
                    <span className="text-[11px] leading-none">{showBody ? "\u2212" : "+"}</span>
                </button>
                <NodeIcon type={span.node_type} />
                <span className="truncate text-[13px] text-foreground">{span.node_name}</span>
                <span className="shrink-0 text-2xs tracking-wide text-muted-foreground/70">
                    {TYPE_LABEL[span.node_type]}
                </span>
                {span.status === "ERROR" && (
                    <span className="shrink-0 rounded bg-destructive/10 px-1.5 py-0.5 text-2xs text-destructive">error</span>
                )}
                <span className="ml-auto shrink-0 font-mono text-2xs text-muted-foreground/45" title={`span_id ${span.span_id}`}>
                    {span.span_id}
                </span>
                <span className="w-14 shrink-0 text-right font-mono text-xs tabular-nums text-muted-foreground/70">
                    {dur(d.duration_ms)}
                </span>
            </div>

            {showBody && hasDetail && (
                <div className="mb-1 ml-[28px] space-y-1.5">
                    {d.input_value && <SpanField label="Input" value={d.input_value} />}
                    {d.output_value && <SpanField label="Output" value={d.output_value} />}
                    {d.error_message && <SpanField label="Error" value={d.error_message} tone="error" />}
                </div>
            )}
            {showBody && kids.map((c) => (
                <SpanNodeTree key={c.span_id} span={c} all={all} depth={depth + 1} expandAll={expandAll} />
            ))}
        </div>
    );
}

function SpanField({ label, value, tone }: { label: string; value: string; tone?: "error" }) {
    return (
        <div>
            <div className="mb-0.5 text-2xs tracking-wide text-muted-foreground/70">{label.toUpperCase()}</div>
            <pre className={`max-h-40 overflow-auto rounded-md border border-border px-2.5 py-2 font-mono text-2xs leading-relaxed whitespace-pre-wrap ${
                tone === "error" ? "bg-destructive/5 text-destructive" : "bg-surface-subtle text-muted-foreground"
            }`}>{value.slice(0, 1200)}</pre>
        </div>
    );
}

/**
 * One turn. Spans are optional: the optimised build renders from the list
 * projection and asks for them only when a turn is opened, so a 900-turn
 * session costs one page of summaries instead of 900 full documents.
 */
export function SessionTurn({
    trace, spans, highlighted, divider, expanded, onToggle, loadingSpans,
}: {
    trace: TraceSummary;
    spans?: Span[];
    highlighted: boolean;
    divider: boolean;
    expanded: boolean;
    onToggle: () => void;
    loadingSpans?: boolean;
}) {
    const [expandAll, setExpandAll] = useState(false);
    const roots = (spans ?? []).filter((s) => !s.parent_span_id);

    const input = trace.input || trace.name;
    const output = trace.output || "";

    return (
        <section id={`turn-${trace._id}`} className={divider ? "border-t border-border pt-8" : ""}>
            <div className="mb-3 flex flex-col items-end">
                <span className="mb-1.5 text-2xs tracking-wide text-muted-foreground/70">INPUT</span>
                <div className={`max-w-[70%] rounded-xl border px-4 py-2.5 text-[13px] text-foreground ${
                    highlighted ? "border-foreground/25 bg-muted" : "border-border bg-background"
                }`}>
                    {input}
                </div>
            </div>

            <div className="rounded-xl border border-border">
                <div className="flex items-center gap-2 px-3.5 py-2.5">
                    <button type="button" onClick={onToggle}
                        className="flex cursor-pointer items-center gap-2 text-muted-foreground transition-colors hover:text-foreground">
                        {expanded ? <ChevronDownIcon className="size-4" /> : <ChevronRightIcon className="size-4" />}
                        <span className="text-2xs tracking-wide">
                            {trace.spanCount} {trace.spanCount === 1 ? "STEP" : "STEPS"} · {dur(trace.latency).toUpperCase()}
                        </span>
                    </button>
                    {trace.status === "error" && (
                        <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-2xs text-destructive">error</span>
                    )}
                    <span className="font-mono text-2xs text-muted-foreground/45" title={`trace ${trace._id}`}>
                        #{trace.id} · {trace._id.slice(0, 16)}…
                    </span>
                    {expanded && spans && (
                        <button type="button" onClick={() => setExpandAll((e) => !e)}
                            className="ml-auto cursor-pointer text-2xs tracking-wide text-muted-foreground transition-colors hover:text-foreground">
                            {expandAll ? "COLLAPSE ALL" : "EXPAND ALL"}
                        </button>
                    )}
                </div>
                {expanded && (
                    <div className="border-t border-border px-3.5 py-1.5">
                        {loadingSpans && <div className="py-2 text-2xs text-muted-foreground">loading steps…</div>}
                        {spans && roots.map((s) => (
                            <SpanNodeTree key={s.span_id} span={s} all={spans} depth={0} expandAll={expandAll} />
                        ))}
                    </div>
                )}
            </div>

            <div className="mt-5 mb-8">
                <div className="mb-1.5 text-2xs tracking-wide text-muted-foreground/70">OUTPUT</div>
                <div className="text-[15px] text-foreground">{output || "—"}</div>
            </div>
        </section>
    );
}
