"use client";

import type { TraceSummary } from "@/lib/types";
import { StatusSuccessIcon, StatusErrorIcon, ReplayIcon, ChevronUpIcon, ChevronDownIcon } from "./icons";

/*
 * Geometry measured off app.neatlogs.com:
 *   header row  40px, background --muted, sticky
 *   body row    41px  (cells are h-10 plus a 1px bottom border)
 *   every cell  padding-left 28px / padding-right 10px  (`[&>td]:pl-7` + `px-2.5`)
 *
 * Their markup is a real <table>; this is a flex grid with the same fixed
 * widths, which renders identically and can be virtualised — a <table> cannot
 * have absolutely positioned rows.
 */
export const ROW_HEIGHT = 41;
export const HEADER_HEIGHT = 40;

export interface Column {
    id: string;
    label: string;
    width: number;
    grow?: boolean;
    align?: "left" | "center";
}

/** Their column set, minus the ones our data never fills (detections, evals,
 *  comments) and plus the numeric ones their own row payload already carries.
 *  No select column either: theirs opens a bulk-action bar this demo has no
 *  actions for, so it was a checkbox that could be ticked and never used. */
export const COLUMNS: Column[] = [
    { id: "ingestedAt", label: "Ingested at", width: 140 },
    { id: "replay", label: "Replay", width: 112, align: "center" },
    { id: "status", label: "Status", width: 90, align: "center" },
    { id: "input", label: "Input", width: 230, grow: true },
    { id: "output", label: "Output", width: 230, grow: true },
    { id: "workflow", label: "Workflow", width: 146 },
    { id: "spans", label: "Spans", width: 92 },
    { id: "tokens", label: "Tokens", width: 104 },
    { id: "latency", label: "Latency", width: 112 },
    { id: "traceId", label: "Trace", width: 130 },
];

export const cellStyle = (c: Column): React.CSSProperties => ({
    width: c.width,
    flex: c.grow ? `1 1 ${c.width}px` : `0 0 ${c.width}px`,
    paddingLeft: 28,
    paddingRight: 10,
    justifyContent: c.align === "center" ? "center" : "flex-start",
});

export function TableHeader({ sortDesc = true }: { sortDesc?: boolean }) {
    return (
        <div
            className="sticky top-0 z-10 flex w-full items-center border-b border-border bg-muted"
            style={{ height: HEADER_HEIGHT }}
        >
            {COLUMNS.map((c) => (
                <div
                    key={c.id}
                    style={cellStyle(c)}
                    className="flex h-full min-w-0 items-center truncate text-[13px] text-secondary-foreground/80"
                >
                    <button type="button" className="flex min-w-0 cursor-pointer items-center gap-1 uppercase select-none">
                        <span className="truncate">{c.label}</span>
                        {c.id === "ingestedAt" && (
                            <span className="flex shrink-0 flex-col leading-none text-muted-foreground/50">
                                <ChevronUpIcon className="size-3" />
                                {sortDesc && <ChevronDownIcon className="size-3 -mt-[5px]" />}
                            </span>
                        )}
                    </button>
                </div>
            ))}
        </div>
    );
}

const fmtTime = (ms: number) =>
    new Date(ms).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
const fmtDay = (ms: number) =>
    new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const fmtLatency = (ms: number) =>
    ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`;

export function TraceRow({
    trace, onOpen, animate = false,
}: {
    trace: TraceSummary;
    onOpen: (t: TraceSummary) => void;
    animate?: boolean;
}) {
    const cell = (c: Column, children: React.ReactNode) => (
        <div key={c.id} style={cellStyle(c)} className="flex h-full min-w-0 items-center truncate">
            {children}
        </div>
    );

    return (
        <div
            onClick={() => onOpen(trace)}
            data-trace-id={trace.id}
            className={`flex w-full cursor-pointer items-center border-b border-border-soft text-[13px] text-muted-foreground transition-colors hover:bg-surface-subtle/80 ${
                animate ? "row-fade" : ""
            }`}
            style={{ height: ROW_HEIGHT }}
        >
            {COLUMNS.map((c) => {
                switch (c.id) {
                    case "ingestedAt":
                        return cell(c, (
                            <span className="block max-w-full truncate font-mono whitespace-nowrap tabular-nums">
                                <span className="text-xs text-foreground/85">{fmtTime(trace.ts)}</span>
                                <span className="ml-1.5 text-2xs text-muted-foreground/76">{fmtDay(trace.ts)}</span>
                            </span>
                        ));
                    case "replay":
                        return cell(c, (
                            <button
                                type="button"
                                title="Open session replay"
                                onClick={(e) => { e.stopPropagation(); onOpen(trace); }}
                                className="flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            >
                                <ReplayIcon />
                            </button>
                        ));
                    case "status":
                        return cell(c, trace.status === "success"
                            ? <StatusSuccessIcon className="size-4 text-success" />
                            : <StatusErrorIcon className="size-4 text-destructive" />);
                    case "input":
                        return cell(c, (
                            <span className="truncate text-foreground/85" title={trace.input}>
                                {trace.input || trace.name}
                            </span>
                        ));
                    case "output":
                        return cell(c, (
                            <span className="truncate" title={trace.output}>
                                {trace.output || <span className="text-muted-foreground">–</span>}
                            </span>
                        ));
                    case "workflow":
                        return cell(c, <span className="truncate">{trace.workflowName || "—"}</span>);
                    case "spans":
                        return cell(c, <span className="font-mono text-xs tabular-nums">{trace.spanCount}</span>);
                    case "tokens":
                        return cell(c, (
                            <span className="font-mono text-xs tabular-nums">
                                {trace.totalTokensUsed.toLocaleString()}
                            </span>
                        ));
                    case "latency":
                        return cell(c, (
                            <span className="font-mono text-xs tabular-nums">{fmtLatency(trace.latency)}</span>
                        ));
                    case "traceId":
                        // The real 32-hex trace id, truncated. Resolvable at
                        // /api/traces/<id>, so a row can be checked against the
                        // source rather than taken on trust.
                        return cell(c, (
                            <span className="truncate font-mono text-2xs text-muted-foreground/70" title={trace._id}>
                                {trace._id.slice(0, 12)}…
                            </span>
                        ));
                    default:
                        return cell(c, <span className="text-muted-foreground">–</span>);
                }
            })}
        </div>
    );
}

export const TOTAL_FIXED_WIDTH = COLUMNS.reduce((n, c) => n + c.width, 0);
