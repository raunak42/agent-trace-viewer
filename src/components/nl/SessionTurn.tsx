"use client";

import { useState } from "react";
import type { Span, TraceSummary } from "@/lib/types";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { Link04Icon, RoboticIcon, Search01Icon, Wrench01Icon } from "@hugeicons/core-free-icons";
import { ChevronDownIcon, ChevronRightIcon } from "./icons";
import { StepsSkeleton } from "./Skeleton";

/*
 * Node-type glyphs, straight from the library app.neatlogs.com uses. Their
 * rendered paths matched Hugeicons byte for byte — the robot is RoboticIcon,
 * the link is Link04Icon (Unlink04 carries the same two paths plus two tick
 * marks) — so the icons are imported rather than transcribed, which also
 * settles the tool glyph the trace we measured had no span for.
 *
 * Named imports off a 5,443-icon barrel, but the package declares no side
 * effects, so only what is referenced here is bundled.
 */
const NODE_ICON: Record<Span["node_type"], IconSvgElement> = {
    agent_action: RoboticIcon,
    chain: Link04Icon,
    tool_call: Wrench01Icon,
    retrieval: Search01Icon,
};

const NodeIcon = ({ type }: { type: Span["node_type"] }) => (
    <span className="relative inline-flex shrink-0 text-primary transition-colors">
        <span className="flex shrink-0 items-center justify-center" style={{ width: 17, height: 17 }}>
            <HugeiconsIcon icon={NODE_ICON[type]} size={17} strokeWidth={1.5} aria-hidden />
        </span>
    </span>
);

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

/*
 * Rail geometry, measured off app.neatlogs.com: each level indents 37px, and
 * the spine sits at the parent's ring centre — 12px in, being pl-1 plus half
 * of the 16px ring. The row is 32px tall, so that centre is 16px down.
 *
 * Theirs is one unbroken line because every node contributes a segment that
 * meets its neighbours: the parent bridges from its ring down to its row's
 * bottom, and each child carries the line through its whole subtree unless it
 * is the last, where it stops at the ring and turns into the stub. Drawing an
 * "L" per child instead leaves a gap wherever a subtree is taller than the
 * stub, which is what made ours look cut up.
 */
const INDENT = 37;
const RAIL_X = 12;
const ROW_MID = 16;
/** Spine to the ring's left edge, not its centre — the stub stops at the circle. */
const STUB_W = INDENT - 8;

const Rail = ({ top, height, bottom }: { top: number; height?: number; bottom?: number }) => (
    <span className="absolute w-px bg-border" aria-hidden
        style={{ left: RAIL_X, top, ...(bottom !== undefined ? { bottom } : { height }) }} />
);

/** One node plus its subtree. `all` stays the complete span list so the
 *  recursion can find grandchildren, not just immediate kids. */
function SpanNodeTree({ span, all, depth, expandAll, last = true }: {
    span: Span; all: Span[]; depth: number; expandAll: boolean;
    /** Last of its siblings, so the spine stops here rather than passing through. */
    last?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const kids = all.filter((s) => s.parent_span_id === span.span_id);
    const d = span.data;
    const hasDetail = Boolean(d.input_value || d.output_value || d.error_message);
    const expandable = kids.length > 0 || hasDetail;
    const showBody = expandAll || open;

    return (
        <div className="relative" style={{ paddingLeft: depth === 0 ? 0 : INDENT }}>
            {depth > 0 && (
                <>
                    {/* Through the whole subtree, or stopping at the ring if
                        this is the last child. */}
                    {last
                        ? <Rail top={0} height={ROW_MID} />
                        : <Rail top={0} bottom={0} />}
                    <span className="absolute h-px bg-border" aria-hidden
                        style={{ left: RAIL_X, top: ROW_MID, width: STUB_W }} />
                </>
            )}
            {/* The bridge from this node's own ring into its children. */}
            {showBody && kids.length > 0 && <Rail top={ROW_MID} height={ROW_MID} />}
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
                {/* Above the rail: the segments tile through the ring's own
                    band to stay contiguous, and the filled circle is what hides
                    the crossing — the line reads as meeting its edge. */}
                <span className="relative z-[1] flex w-4 shrink-0 items-center justify-center">
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
                // The body sits between this node's row and its children, so
                // the spine has to run past it. Two elements rather than one:
                // the rail is measured from this node's own left edge, and the
                // fields are indented, which cannot both be one box.
                // Padding, not a margin, for the gap under the fields: a
                // bottom margin on the last in-flow child collapses out of this
                // box, so the rail — which ends at the box — stopped 4px short
                // of the next row's own segment.
                <div className="relative pb-1">
                    {kids.length > 0 && <Rail top={0} bottom={0} />}
                    <div className="space-y-1.5" style={{ marginLeft: INDENT }}>
                        {d.input_value && <SpanField label="Input" value={d.input_value} />}
                        {d.output_value && <SpanField label="Output" value={d.output_value} />}
                        {d.error_message && <SpanField label="Error" value={d.error_message} tone="error" />}
                    </div>
                </div>
            )}
            {showBody && kids.map((c, i) => (
                <SpanNodeTree key={c.span_id} span={c} all={all} depth={depth + 1}
                    expandAll={expandAll} last={i === kids.length - 1} />
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
