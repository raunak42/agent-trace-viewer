"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { fetchSessionPage } from "@/lib/api";
import { useSessionTail } from "@/lib/useSessionTail";
import type { Trace, TraceSummary } from "@/lib/types";
import { SessionTurn } from "./SessionTurn";
import { NewArrivalsPill } from "../NewArrivalsPill";

const PAGE = 50;

/** Turns are always expanded here, so the toggle is inert — hoisted so it is
 *  not rebuilt for every mounted turn on every render. */
const NOOP = () => {};

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
export function SessionNaive({ sessionId, anchorId, onStats, onTail, onHeader }: {
    sessionId: string;
    anchorId: string;
    onStats: (s: { loaded: number; total: number; mounted: number }) => void;
    onTail: (t: { kept: number; discarded: number; bytes: number }) => void;
    onHeader: (h: { history: number | null; arrived: number; loaded: number }) => void;
}) {
    const [turns, setTurns] = useState<Trace[]>([]);
    const [total, setTotal] = useState(0);
    const [done, setDone] = useState(false);
    /** Turns present when this page first fetched, and turns that have arrived
     *  since, kept apart for the header. */
    const [history, setHistory] = useState<number | null>(null);
    const [arrived, setArrived] = useState(0);

    // Ids already held, so a live turn that the drain also returned is not
    // added twice. Declared before the drain effect that fills it.
    const known = useRef<Set<number>>(new Set());
    /** The drain replaces the whole array each page, so nothing else may write
     *  to it until the drain has caught up with the end of the session. */
    const drained = useRef(false);

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
                for (const t of page.logs as Trace[]) known.current.add(t.id);
                all.push(...(page.logs as Trace[]));
                setTotal(page.total);
                setHistory((h) => h ?? page.total);
                setTurns([...all]);
                if (!page.hasMore || page.nextCursor === null) break;
                after = page.nextCursor;
            }
            if (cancelled) return;
            drained.current = true;
            setDone(true);
        })();

        return () => { cancelled = true; };
    }, [sessionId]);

    // Subscribes to everything and keeps the fraction that matches, so the
    // socket carries every other session's full documents for nothing.
    const handleTurn = useCallback((turn: TraceSummary) => {
        // Ignored until the drain finishes, for two reasons. The drain assigns
        // the whole array on every page, so an appended turn is wiped by the
        // next one — and it would be recorded as known, so nothing would ever
        // add it back. It would also be out of order: a turn arriving now is
        // newer than turns the drain has not reached yet. Nothing is lost by
        // waiting, because the drain runs until the session has no more pages,
        // so it collects these itself.
        if (!drained.current) return;
        if (known.current.has(turn.id)) return;
        known.current.add(turn.id);
        setTurns((prev) => [...prev, turn as Trace]);
        setTotal((n) => n + 1);
        setArrived((n) => n + 1);
    }, []);
    const tail = useSessionTail({ sessionId, filtered: false, onTurn: handleTurn });
    useEffect(() => { onTail(tail); }, [tail, onTail]);

    useEffect(() => {
        onStats({ loaded: turns.length, total, mounted: turns.length });
    }, [turns.length, total, onStats]);
    useEffect(() => {
        onHeader({ history, arrived, loaded: turns.length });
    }, [history, arrived, turns.length, onHeader]);

    const scrollRef = useRef<HTMLDivElement>(null);
    const atBottom = useRef(true);
    const [newCount, setNewCount] = useState(0);
    // Mirrors newCount so the scroll handler can tell whether a reset would
    // actually change anything. Pinning to the end writes scrollTop, which
    // raises a scroll event, which reset the count again — a cycle React
    // eventually refuses.
    const counted = useRef(0);

    // Same following rules as the other build, and for the same reason: this
    // one is meant to be slow, not unusable. It still drains the whole session
    // as full documents and still mounts every turn.
    useEffect(() => {
        const root = scrollRef.current;
        if (!root) return;
        const sync = () => {
            const following = root.scrollHeight - root.clientHeight - root.scrollTop <= 4;
            atBottom.current = following;
            if (following && counted.current !== 0) { counted.current = 0; setNewCount(0); }
        };
        root.addEventListener("scroll", sync, { passive: true });
        return () => root.removeEventListener("scroll", sync);
    }, []);

    // Whether to pin is decided from the height this container had before the
    // commit, not from the ref the scroll listener maintains. Scroll events are
    // delivered asynchronously, so during the initial drain — which commits
    // every few milliseconds — a reader can scroll away and have this effect
    // run, and win, before the listener has been told. Comparing against the
    // previous height cannot be raced that way.
    const seen = useRef(0);
    const prevHeight = useRef(0);
    useLayoutEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        const wasAtEnd = prevHeight.current === 0
            || prevHeight.current - el.clientHeight - el.scrollTop <= 4;
        if (wasAtEnd) el.scrollTop = el.scrollHeight;
        prevHeight.current = el.scrollHeight;
        atBottom.current = wasAtEnd;
    }, [turns.length]);

    // The count is state, so it is updated after paint instead.
    useEffect(() => {
        const grew = turns.length - seen.current;
        seen.current = turns.length;
        if (grew <= 0 || atBottom.current) return;
        counted.current += grew;
        setNewCount(counted.current);
    }, [turns.length]);

    const jumpToLatest = () => {
        const el = scrollRef.current;
        if (el) el.scrollTop = el.scrollHeight;
        counted.current = 0;
        setNewCount(0);
        atBottom.current = true;
    };

    return (
        <div className="relative h-full">
        <div ref={scrollRef} className="nl-scroll h-full overflow-auto px-6 py-5" data-session-root>
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
                        onToggle={NOOP}
                        highlighted={t._id === anchorId}
                        divider={i > 0}
                    />
                ))}
            </div>
        </div>
        <NewArrivalsPill count={newCount} onClick={jumpToLatest} direction="down" />
        </div>
    );
}
