"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchSessionList } from "@/lib/api";
import type { SessionSummary } from "@/lib/types";
import { StatusSuccessIcon, StatusErrorIcon } from "./icons";

const COLUMNS = [
    { id: "started", label: "Started", width: 140 },
    { id: "status", label: "Status", width: 90, center: true },
    { id: "opened", label: "Opened with", width: 300, grow: true },
    { id: "latest", label: "Latest", width: 260, grow: true },
    { id: "workflow", label: "Workflow", width: 160 },
    { id: "turns", label: "Turns", width: 110 },
    { id: "errors", label: "Errors", width: 100 },
] as const;

const cellStyle = (c: (typeof COLUMNS)[number]): React.CSSProperties => ({
    width: c.width,
    flex: "grow" in c && c.grow ? `1 1 ${c.width}px` : `0 0 ${c.width}px`,
    paddingLeft: 28,
    paddingRight: 10,
    justifyContent: "center" in c && c.center ? "center" : "flex-start",
});

const clock = (ms: number) =>
    new Date(ms).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
const day = (ms: number) => new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric" });

/**
 * One row per conversation rather than per turn.
 *
 * The turn-level list cannot reach a large conversation: it is newest-first and
 * one thread receives at a time, so the rows at the top always belong to the
 * thread that just started. A fifty-thousand-turn session sits below every turn
 * of the current one, and nothing on screen says it is there. This is the view
 * that makes it reachable — and it is what the counts are for.
 *
 * Refreshed on a timer rather than streamed: a session summary changes far more
 * slowly than the turns inside it.
 */
export function SessionList() {
    const [sessions, setSessions] = useState<SessionSummary[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    useEffect(() => {
        let cancelled = false;
        const load = () => {
            fetchSessionList(200)
                .then((r) => { if (!cancelled) { setSessions(r.sessions); setError(null); } })
                .catch((e) => { if (!cancelled) setError(String(e?.message ?? e)); });
        };
        load();
        const id = setInterval(load, 5000);
        return () => { cancelled = true; clearInterval(id); };
    }, []);

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <div
                className="sticky top-0 z-10 flex w-full items-center border-b border-border bg-muted"
                style={{ height: 40 }}
            >
                {COLUMNS.map((c) => (
                    <div key={c.id} style={cellStyle(c)}
                        className="flex h-full min-w-0 items-center truncate text-[13px] text-secondary-foreground/80">
                        <span className="truncate uppercase">{c.label}</span>
                    </div>
                ))}
            </div>

            <div className="nl-scroll min-h-0 flex-1 overflow-auto" data-list-root>
                {error && <div className="p-6 text-[13px] text-destructive">{error}</div>}
                {!sessions && !error && (
                    <div className="p-6 text-[13px] text-muted-foreground">Loading conversations…</div>
                )}
                {sessions?.map((s) => (
                    <div
                        key={s.sessionId}
                        onClick={() => router.push(`/traces/${s.lastTraceId}`)}
                        data-session-id={s.sessionId}
                        className="flex w-full cursor-pointer items-center border-b border-border-soft text-[13px] text-muted-foreground transition-colors hover:bg-surface-subtle/80"
                        style={{ height: 41 }}
                    >
                        {COLUMNS.map((c) => {
                            const cell = (children: React.ReactNode) => (
                                <div key={c.id} style={cellStyle(c)} className="flex h-full min-w-0 items-center truncate">
                                    {children}
                                </div>
                            );
                            switch (c.id) {
                                case "started":
                                    return cell(
                                        <span className="block truncate font-mono whitespace-nowrap tabular-nums">
                                            <span className="text-xs text-foreground/85">{clock(s.startedAt)}</span>
                                            <span className="ml-1.5 text-2xs text-muted-foreground/76">{day(s.startedAt)}</span>
                                        </span>,
                                    );
                                case "status":
                                    return cell(s.errors > 0
                                        ? <StatusErrorIcon className="size-4 text-destructive" />
                                        : <StatusSuccessIcon className="size-4 text-success" />);
                                case "opened":
                                    return cell(<span className="truncate text-foreground/85" title={s.input}>{s.input || "—"}</span>);
                                case "latest":
                                    return cell(<span className="truncate" title={s.output}>{s.output || "—"}</span>);
                                case "workflow":
                                    return cell(
                                        <span className="flex min-w-0 items-center gap-2">
                                            <span className="truncate">{s.workflowName || "—"}</span>
                                            {s.live && <span className="size-1.5 shrink-0 animate-pulse rounded-full bg-success" />}
                                        </span>,
                                    );
                                case "turns":
                                    return cell(
                                        <span className="font-mono text-xs tabular-nums text-foreground/85">
                                            {s.turns.toLocaleString()}
                                        </span>,
                                    );
                                default:
                                    return cell(
                                        <span className={`font-mono text-xs tabular-nums ${s.errors ? "text-destructive" : ""}`}>
                                            {s.errors.toLocaleString()}
                                        </span>,
                                    );
                            }
                        })}
                    </div>
                ))}
            </div>
        </div>
    );
}
