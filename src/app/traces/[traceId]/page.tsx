"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { fetchSession } from "@/lib/api";
import type { Span, Trace } from "@/lib/types";
import { SessionTurn } from "@/components/nl/SessionTurn";
import { ChevronDownIcon, ChevronRightIcon, ChevronLeftIcon, SlidersIcon } from "@/components/nl/icons";

/**
 * Their row click is a route, not a panel: /traces/{traceId} opens the whole
 * session the trace belongs to, rendered as a transcript of turns, and scrolls
 * to the one that was clicked.
 */
export default function TraceSessionPage({ params }: { params: Promise<{ traceId: string }> }) {
    const { traceId } = use(params);
    const [turns, setTurns] = useState<Trace[] | null>(null);
    const [anchor, setAnchor] = useState<Trace | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        fetchSession(traceId)
            .then(({ anchor, turns }) => { if (!cancelled) { setAnchor(anchor); setTurns(turns); } })
            .catch((e) => { if (!cancelled) setError(String(e?.message ?? e)); });
        return () => { cancelled = true; };
    }, [traceId]);

    // Land on the turn that was clicked, the way their deep link does.
    useEffect(() => {
        if (!turns || !anchor) return;
        document.getElementById(`turn-${anchor._id}`)?.scrollIntoView({ block: "center" });
    }, [turns, anchor]);

    const stamp = anchor
        ? new Date(anchor.ts).toLocaleString("en-GB", {
              day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true,
          })
        : "";

    const errorTurns = new Set((turns ?? []).filter((t) => t.status === "error").map((t) => t._id));

    return (
        <main className="flex h-dvh flex-col bg-background text-foreground">
            <header className="flex h-[68px] shrink-0 items-center justify-between border-b border-border px-4">
                <div className="flex min-w-0 items-center gap-3">
                    <Link href="/optimized" aria-label="Back to traces"
                        className="flex size-8 shrink-0 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-muted">
                        <ChevronLeftIcon className="size-4" />
                    </Link>
                    <button type="button" className="flex cursor-pointer items-center gap-1.5 text-[15px] text-foreground">
                        {stamp}
                        <ChevronDownIcon className="size-4 text-muted-foreground" />
                    </button>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    <button type="button"
                        className="flex h-9 cursor-pointer items-center gap-2 rounded-full bg-[#18181b] px-4 text-[13px] font-medium text-white transition-colors hover:bg-[#27272a]">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                            <path d="M8 5v14l11-7z" />
                        </svg>
                        Watch replay
                    </button>
                    <button type="button" aria-label="Display preferences"
                        className="flex size-9 cursor-pointer items-center justify-center rounded-lg border border-border text-foreground transition-colors hover:bg-muted">
                        <SlidersIcon />
                    </button>
                </div>
            </header>

            <div className="relative flex min-h-0 flex-1">
                <div className="nl-scroll min-w-0 flex-1 overflow-auto px-6 py-5">
                    <div className="mx-auto w-full max-w-[960px]">
                        {anchor && (
                            <button type="button"
                                className="mb-8 flex cursor-pointer items-center gap-2 rounded-xl border border-border px-3.5 py-2.5 text-[13px] transition-colors hover:bg-muted">
                                <span className="text-foreground">session</span>
                                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                                    {turns?.length ?? "…"} {turns?.length === 1 ? "turn" : "turns"}
                                </span>
                                {errorTurns.size > 0 && <span className="size-1.5 rounded-full bg-destructive" />}
                                <ChevronRightIcon className="size-4 text-muted-foreground" />
                            </button>
                        )}

                        {error && <div className="text-[13px] text-destructive">{error}</div>}
                        {!turns && !error && <div className="text-[13px] text-muted-foreground">Loading session…</div>}

                        {turns?.map((t, i) => (
                            <SessionTurn
                                key={t._id}
                                trace={t}
                                highlighted={t._id === anchor?._id}
                                divider={i > 0}
                            />
                        ))}
                    </div>
                </div>

                {/* Their session minimap: one tick per turn, red where it failed. */}
                {turns && (
                    <div className="hidden w-8 shrink-0 flex-col items-center justify-center gap-[3px] py-6 lg:flex">
                        {turns.map((t) => (
                            <a key={t._id} href={`#turn-${t._id}`} title={t.name}
                                className={`h-[3px] rounded-full transition-all ${
                                    t._id === anchor?._id ? "w-5 bg-foreground"
                                    : t.status === "error" ? "w-3.5 bg-destructive"
                                    : "w-3 bg-border hover:bg-muted-foreground/40"
                                }`} />
                        ))}
                    </div>
                )}
            </div>
        </main>
    );
}

export type { Span };
