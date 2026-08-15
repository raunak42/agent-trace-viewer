"use client";

import { useEffect, useState } from "react";
import { fetchSessionPage } from "@/lib/api";
import { useSessionTail } from "@/lib/useSessionTail";
import type { Trace } from "@/lib/types";
import { SessionTurn } from "./SessionTurn";

const PAGE = 50;

/**
 * The unoptimised session view — what the shape of the page invites you to
 * write, and what app.neatlogs.com ships. It differs from the optimised build
 * in three ways, all of them about volume rather than correctness:
 *
 *   1. every turn in the session is fetched before anything renders, as full
 *      documents with spans (~3.9 KB each rather than ~0.75 KB)
 *   2. every turn is mounted, and stays mounted
 *   3. every span tree is expanded, so the DOM carries the whole session
 */
export function SessionNaive({ sessionId, anchorId, onStats, onTail }: {
    sessionId: string;
    anchorId: string;
    onStats: (s: { loaded: number; total: number; mounted: number }) => void;
    onTail: (t: { kept: number; discarded: number; bytes: number }) => void;
}) {
    const [turns, setTurns] = useState<Trace[]>([]);
    const [total, setTotal] = useState(0);
    const [done, setDone] = useState(false);

    useEffect(() => {
        // No mount guard: React remounts effects in development, and a guard
        // here would block the second run while the first had already been
        // cancelled — leaving the drain half-done and the view empty.
        let cancelled = false;

        (async () => {
            let after: number | undefined;
            const all: Trace[] = [];
            // Drains the entire session before the first paint.
            for (let guard = 0; guard < 200; guard += 1) {
                const page = await fetchSessionPage(sessionId, {
                    after, limit: PAGE, projection: "session", view: "naive",
                });
                if (cancelled) return;
                all.push(...(page.logs as Trace[]));
                setTotal(page.total);
                setTurns([...all]);
                if (!page.hasMore || page.nextCursor === null) break;
                after = page.nextCursor;
            }
            if (!cancelled) setDone(true);
        })();

        return () => { cancelled = true; };
    }, [sessionId]);

    // Subscribes to everything and keeps the fraction that matches, so the
    // socket carries every other session's full documents for nothing.
    const tail = useSessionTail({
        sessionId,
        filtered: false,
        onTurn: (turn) => {
            setTurns((prev) => (prev.some((t) => t.id === turn.id) ? prev : [...prev, turn as Trace]));
            setTotal((n) => n + 1);
        },
    });
    useEffect(() => { onTail(tail); }, [tail, onTail]);

    useEffect(() => {
        onStats({ loaded: turns.length, total, mounted: turns.length });
    }, [turns.length, total, onStats]);

    return (
        <div className="nl-scroll h-full overflow-auto px-6 py-5" data-session-root>
            <div className="mx-auto w-full max-w-[960px]">
                {!done && (
                    <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-2xs text-amber-700">
                        fetching every turn as a full document — {turns.length} of {total || "?"}
                    </div>
                )}
                {turns.map((t, i) => (
                    <SessionTurn
                        key={t.id}
                        trace={t}
                        spans={t.spans}
                        expanded
                        onToggle={() => {}}
                        highlighted={t._id === anchorId}
                        divider={i > 0}
                    />
                ))}
            </div>
        </div>
    );
}
