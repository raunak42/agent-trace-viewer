"use client";

import { useState } from "react";
import type { Span, TraceSummary } from "@/lib/types";
import { ChevronDownIcon, ChevronRightIcon } from "./icons";
import { StepsSkeleton } from "./Skeleton";

/*
 * Node-type glyphs, taken from app.neatlogs.com: Hugeicons, 24×24 viewBox,
 * 1.5 stroke, currentColor, drawn into a 17px box. Agent and chain are their
 * exact paths, lifted off the rendered SVG. The trace we measured had no tool
 * spans, so that one is the same family's wrench rather than a copy.
 */
const NodeIcon = ({ type }: { type: Span["node_type"] }) => {
    const p = { xmlns: "http://www.w3.org/2000/svg", width: 24, height: 24, viewBox: "0 0 24 24",
                fill: "none", stroke: "currentColor", strokeWidth: 1.5,
                className: "size-full", "aria-hidden": true };
    const icon = () => {
        switch (type) {
            case "agent_action":
                return (
                    <svg {...p} strokeLinejoin="round">
                        <path d="M19 16V14C19 11.1716 19 9.75736 18.1213 8.87868C17.2426 8 15.8284 8 13 8H11C8.17157 8 6.75736 8 5.87868 8.87868C5 9.75736 5 11.1716 5 14V16C5 18.8284 5 20.2426 5.87868 21.1213C6.75736 22 8.17157 22 11 22H13C15.8284 22 17.2426 22 18.1213 21.1213C19 20.2426 19 18.8284 19 16Z" />
                        <path d="M19 18C20.4142 18 21.1213 18 21.5607 17.5607C22 17.1213 22 16.4142 22 15C22 13.5858 22 12.8787 21.5607 12.4393C21.1213 12 20.4142 12 19 12" />
                        <path d="M5 18C3.58579 18 2.87868 18 2.43934 17.5607C2 17.1213 2 16.4142 2 15C2 13.5858 2 12.8787 2.43934 12.4393C2.87868 12 3.58579 12 5 12" />
                        <path d="M13.5 3.5C13.5 4.32843 12.8284 5 12 5C11.1716 5 10.5 4.32843 10.5 3.5C10.5 2.67157 11.1716 2 12 2C12.8284 2 13.5 2.67157 13.5 3.5Z" strokeLinejoin="miter" />
                        <path d="M12 5V8" strokeLinecap="round" />
                        <path d="M9 13V14" strokeLinecap="round" />
                        <path d="M15 13V14" strokeLinecap="round" />
                        <path d="M10 17.5C10 17.5 10.6667 18 12 18C13.3333 18 14 17.5 14 17.5" strokeLinecap="round" />
                    </svg>
                );
            case "chain":
                return (
                    <svg {...p} strokeLinecap="round">
                        <path d="M10 13.229C10.1416 13.4609 10.3097 13.6804 10.5042 13.8828C11.7117 15.1395 13.5522 15.336 14.9576 14.4722C15.218 14.3121 15.4634 14.1157 15.6872 13.8828L18.9266 10.5114C20.3578 9.02184 20.3578 6.60676 18.9266 5.11718C17.4953 3.6276 15.1748 3.62761 13.7435 5.11718L13.03 5.85978" />
                        <path d="M10.9703 18.14L10.2565 18.8828C8.82526 20.3724 6.50471 20.3724 5.07345 18.8828C3.64218 17.3932 3.64218 14.9782 5.07345 13.4886L8.31287 10.1172C9.74413 8.62761 12.0647 8.6276 13.4959 10.1172C13.6904 10.3195 13.8584 10.539 14 10.7708" />
                    </svg>
                );
            case "tool_call":
                return (
                    <svg {...p} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M15.2 6.8a3.8 3.8 0 0 0 4.62 5.96l-8.6 8.6a2.06 2.06 0 0 1-2.92-2.92l8.6-8.6A3.8 3.8 0 0 0 15.2 6.8Z" />
                        <path d="M15.2 6.8 18.9 3.1M20.9 5.1l-3.7 3.7" />
                    </svg>
                );
            default:
                return (
                    <svg {...p} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 11a8 8 0 1 0-16 0 8 8 0 0 0 16 0ZM17 17l4 4" />
                    </svg>
                );
        }
    };
    return (
        <span className="relative inline-flex shrink-0 text-primary transition-colors">
            <span className="flex shrink-0 items-center justify-center" style={{ width: 17, height: 17 }}>
                {icon()}
            </span>
        </span>
    );
};

/* Their toggle is a 16px ring holding an 8×8 line drawing rather than a text
   glyph: one stroke for collapse, crossed strokes for expand. A "−" set in the
   body face sits half a pixel high and changes width with the font. */
const ToggleGlyph = ({ open }: { open: boolean }) => (
    <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor"
        strokeWidth={1.4} strokeLinecap="round" aria-hidden>
        <line x1="1.5" y1="4" x2="6.5" y2="4" />
        {!open && <line x1="4" y1="1.5" x2="4" y2="6.5" />}
    </svg>
);

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
                    <span className="absolute top-0 left-[12px] h-4 w-px bg-border" aria-hidden />
                    <span className="absolute top-4 left-[12px] h-px w-[26px] bg-border" aria-hidden />
                </>
            )}
            {/* Their whole row is the button, not a control beside a row: one
                hit target, one hover, and the type reads as part of the name
                rather than a badge sitting next to it. Geometry lifted off
                app.neatlogs.com — 32px tall at gap-2.5, py-1.5 pr-2 pl-1. */}
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                disabled={!expandable}
                aria-expanded={showBody}
                className={`group/node relative flex w-full items-center gap-2.5 rounded-md py-1.5 pr-2 pl-1 text-left transition-colors ${
                    expandable ? "cursor-pointer hover:bg-muted/40" : ""
                }`}
            >
                <span className="flex w-4 shrink-0 items-center justify-center">
                    <span className={`flex size-4 items-center justify-center rounded-full border border-border bg-background text-muted-foreground/70 transition-colors ${
                        expandable
                            ? "group-hover/node:border-foreground/25 group-hover/node:text-foreground"
                            : "opacity-0"
                    }`}>
                        <ToggleGlyph open={showBody} />
                    </span>
                </span>
                <NodeIcon type={span.node_type} />
                <span className="truncate tracking-tight text-foreground/85">{span.node_name}</span>
                <span className="shrink-0 font-mono text-4xs tracking-wider text-primary uppercase">
                    {TYPE_LABEL[span.node_type]}
                </span>
                {span.status === "ERROR" && (
                    <span className="shrink-0 rounded bg-destructive/10 px-1.5 py-0.5 text-2xs text-destructive">error</span>
                )}
                {/* A spacer rather than ml-auto on the duration: theirs is an
                    explicit flex-1, which keeps the name from stretching. */}
                <span className="flex-1" />
                <span className="shrink-0 font-mono text-2xs text-muted-foreground/60 tabular-nums">
                    {dur(d.duration_ms)}
                </span>
            </button>

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
            <div className="mb-1 font-mono text-4xs tracking-caps-widest text-muted-foreground/80 uppercase">
                {label}
            </div>
            <pre className={`max-h-40 overflow-auto rounded-xl border px-4 py-3 font-mono text-2xs leading-relaxed whitespace-pre-wrap ${
                tone === "error"
                    ? "border-destructive/20 bg-destructive/5 text-destructive"
                    : "border-border/70 bg-gradient-to-b from-muted/50 to-muted/15 text-muted-foreground"
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
                <span className="mb-1.5 font-mono text-4xs tracking-caps-widest text-muted-foreground/80 uppercase">
                    INPUT
                </span>
                {/* Their bubble: one corner clipped towards the speaker, a
                    top-down wash rather than a flat fill, and a hairline
                    border at 70%. Measured off app.neatlogs.com. */}
                <div className={`max-w-[72%] rounded-xl rounded-tr-[3px] border px-4 py-3 text-[13px] leading-relaxed text-foreground shadow-xs ${
                    highlighted
                        ? "border-foreground/25 bg-muted"
                        : "border-border/70 bg-gradient-to-b from-muted/50 to-muted/15"
                }`}>
                    {input}
                </div>
            </div>

            <div className="rounded-xl border border-border">
                {/* Their bar reads `N STEPS · DURATION` and nothing else — no
                    ids, which ours kept beside it. They are still worth having
                    for a demo about ordering, so they moved to the title. */}
                <div className="flex items-center gap-2 px-3.5 py-2.5"
                    title={`#${trace.id} · trace ${trace._id}`}>
                    <button type="button" onClick={onToggle}
                        className="flex cursor-pointer items-center gap-2 text-muted-foreground transition-colors hover:text-foreground">
                        {expanded ? <ChevronDownIcon className="size-4" /> : <ChevronRightIcon className="size-4" />}
                        <span className="font-mono text-2xs tracking-wider uppercase">
                            {trace.spanCount} {trace.spanCount === 1 ? "STEP" : "STEPS"} · {dur(trace.latency).toUpperCase()}
                        </span>
                    </button>
                    {trace.status === "error" && (
                        <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-2xs text-destructive">error</span>
                    )}
                    {expanded && spans && (
                        <button type="button" onClick={() => setExpandAll((e) => !e)}
                            className="ml-auto cursor-pointer text-2xs tracking-wide text-muted-foreground transition-colors hover:text-foreground">
                            {expandAll ? "COLLAPSE ALL" : "EXPAND ALL"}
                        </button>
                    )}
                </div>
                {expanded && (
                    <div className="border-t border-border px-3.5 py-1.5">
                        {loadingSpans && <StepsSkeleton />}
                        {spans && roots.map((s) => (
                            <SpanNodeTree key={s.span_id} span={s} all={spans} depth={0} expandAll={expandAll} />
                        ))}
                    </div>
                )}
            </div>

            <div className="mt-5 mb-8">
                <div className="mb-1.5 font-mono text-4xs tracking-caps-widest text-muted-foreground/80 uppercase">OUTPUT</div>
                <div className="text-[15px] text-foreground">{output || "—"}</div>
            </div>
        </section>
    );
}
