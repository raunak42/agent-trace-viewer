"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { fetchSessionBulk, fetchSessionPage, fetchTrace } from "@/lib/api";
import { type Build, SESSION_BULK_LIMIT, FANOUT_LIMIT, bulkFetches, fansOut, virtualises } from "@/lib/builds";
import { useSessionTail } from "@/lib/useSessionTail";
import type { Span, TraceSummary } from "@/lib/types";
import { SessionTurn } from "./SessionTurn";
import { NewArrivalsPill } from "../NewArrivalsPill";
import { TurnsSkeleton } from "./Skeleton";

const PAGE = 50;

/**
 * The session transcript, in all three builds.
 *
 * One component on purpose, so the builds differ only where they are meant to.
 *
 *   fanout   an index, then one request per turn, everything mounted
 *   bulk     one request, everything mounted
 *   paged    cursor pages, everything mounted
 *   windowed cursor pages, viewport only
 *
 * fanout against bulk isolates the request count; bulk against paged isolates
 * how much is asked for; paged against windowed isolates how much is mounted.
 * Everything else — the subscription, the projection, the paging behind the
 * first load — is shared by construction.
 */
export function SessionView({ sessionId, anchorId, build, onStats, onTail, onHeader }: {
    sessionId: string;
    anchorId: string;
    build: Build;
    onStats: (s: { loaded: number; total: number; mounted: number; fetched: number }) => void;
    onTail: (t: { kept: number; discarded: number; bytes: number }) => void;
    onHeader: (h: { history: number | null; arrived: number; loaded: number }) => void;
}) {
    const virtualise = virtualises(build);
    const bulk = bulkFetches(build);
    const fanout = fansOut(build);
    const [turns, setTurns] = useState<TraceSummary[]>([]);
    const [total, setTotal] = useState(0);
    const [history, setHistory] = useState<number | null>(null);
    const [arrived, setArrived] = useState(0);
    const [spans, setSpans] = useState<Record<string, Span[]>>({});
    const [pending, setPending] = useState<Record<string, boolean>>({});
    const [open, setOpen] = useState<Record<string, boolean>>({});
    const [newCount, setNewCount] = useState(0);
    const [loadingOlder, setLoadingOlder] = useState(false);
    const [reachedStart, setReachedStart] = useState(false);
    /** How many of the fan-out build's per-turn requests have come back. */
    const [prefetched, setPrefetched] = useState(0);
    const counted = useRef(0);

    const scrollRef = useRef<HTMLDivElement>(null);
    const topSentinel = useRef<HTMLDivElement>(null);
    const bottomSentinel = useRef<HTMLDivElement>(null);
    const atBottom = useRef(true);
    const atTop = useRef(false);

    const busy = useRef(false);
    /** The fan-out is kicked off once, not on every turn that arrives after. */
    const prefetchStarted = useRef(false);
    const prefetchDropped = useRef(false);
    const oldest = useRef<number | undefined>(undefined);
    const newest = useRef<number | undefined>(undefined);
    const moreOlder = useRef(true);
    const moreNewer = useRef(true);
    const didLand = useRef(false);
    /** Height before a prepend, so the viewport can be held in place after it. */
    const heightBefore = useRef<number | null>(null);

    useEffect(() => () => { prefetchDropped.current = true; }, []);

    const ids = useRef<Set<number>>(new Set());
    const addTurns = (incoming: TraceSummary[], side: "older" | "newer") => {
        const fresh = incoming.filter((t) => !ids.current.has(t.id));
        if (fresh.length === 0) return 0;
        for (const t of fresh) ids.current.add(t.id);
        setTurns((prev) => (side === "older" ? [...fresh, ...prev] : [...prev, ...fresh]));
        return fresh.length;
    };

    /**
     * Opens on the newest turns, where a chat opens and where new turns attach.
     * The bulk build asks a different endpoint for all of them at once and then
     * has no history left to page; the others take a page and follow a cursor.
     */
    useEffect(() => {
        let cancelled = false;
        prefetchStarted.current = false;
        (async () => {
            if (bulk) {
                const dump = await fetchSessionBulk(sessionId, fanout ? FANOUT_LIMIT : SESSION_BULK_LIMIT);
                if (cancelled) return;
                for (const t of dump.logs) ids.current.add(t.id);
                setTurns(dump.logs);
                setTotal(dump.total);
                setHistory(dump.total);
                oldest.current = dump.logs[0]?.id;
                newest.current = dump.logs[dump.logs.length - 1]?.id;
                // Only what the cap cut off is left to page back to.
                moreOlder.current = dump.truncated;
                moreNewer.current = false;
                setReachedStart(!dump.truncated);
                return;
            }
            const page = await fetchSessionPage(sessionId, {
                before: Number.MAX_SAFE_INTEGER, limit: PAGE, projection: "list",
            });
            if (cancelled) return;
            for (const t of page.logs) ids.current.add(t.id);
            setTurns(page.logs);
            setTotal(page.total);
            setHistory(page.total);
            oldest.current = page.logs[0]?.id;
            newest.current = page.logs[page.logs.length - 1]?.id;
            moreOlder.current = page.logs.length === PAGE;
            moreNewer.current = false;
        })();
        return () => { cancelled = true; };
    }, [sessionId, bulk, fanout]);

    /**
     * The fan-out build, and the whole reason it exists.
     *
     * app.neatlogs.com's transcript reads the session to get its turns and then
     * issues three more requests for each one — the turn document, its
     * evaluations, its comments. Measured on a 39-turn session that is 117
     * requests, sustained at 16.6/s, averaging 449 ms each, for 18.5 KB of
     * data. The reasoning is sound in isolation: prefetch per turn and opening
     * one is instant. The cost is that the wait scales with turns rather than
     * bytes, and at a few thousand turns the page spends minutes fetching
     * almost nothing.
     *
     * This does the same with one request per turn instead of three. The
     * constant does not change the shape. Nothing is batched and each response
     * writes state on its own, because that is what a per-row query hook does
     * and batching it would be the fix rather than the demonstration.
     */
    useEffect(() => {
        if (!fanout || turns.length === 0 || prefetchStarted.current) return;
        prefetchStarted.current = true;
        for (const t of turns) {
            void fetchTrace(t._id)
                .then((full) => {
                    if (prefetchDropped.current) return;
                    setSpans((prev) => ({ ...prev, [t._id]: full.spans }));
                    setPrefetched((n) => n + 1);
                })
                .catch(() => { if (!prefetchDropped.current) setPrefetched((n) => n + 1); });
        }
        // No cleanup that cancels. This effect re-runs whenever `turns` changes
        // identity, which live is every 200ms, and a cleanup would abandon the
        // fan-out a second after starting it — leaving the build looking cheap
        // for the wrong reason. It is dropped on unmount instead.
    }, [fanout, turns]);

    const loadOlder = useCallback(async () => {
        if (busy.current || !moreOlder.current || oldest.current === undefined) return;
        busy.current = true;
        setLoadingOlder(true);
        heightBefore.current = scrollRef.current?.scrollHeight ?? null;
        try {
            const page = await fetchSessionPage(sessionId, {
                before: oldest.current, limit: PAGE, projection: "list",
            });
            if (page.logs.length === 0) { moreOlder.current = false; return; }
            oldest.current = page.logs[0]?.id ?? oldest.current;
            if (page.logs.length < PAGE) moreOlder.current = false;
            if (addTurns(page.logs, "older") === 0) moreOlder.current = false;
        } finally {
            busy.current = false;
            setLoadingOlder(false);
            setReachedStart(!moreOlder.current);
        }
    }, [sessionId]);

    const handleTurn = useCallback((turn: TraceSummary) => {
        if (moreNewer.current) return;
        if (addTurns([turn], "newer") === 0) return;
        newest.current = turn.id;
        setTotal((n) => n + 1);
        setArrived((n) => n + 1);
        if (!atBottom.current) { counted.current += 1; setNewCount(counted.current); }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const tail = useSessionTail({ sessionId, filtered: true, onTurn: handleTurn });
    useEffect(() => { onTail(tail); }, [tail, onTail]);

    // Called unconditionally because it is a hook, but given nothing to do when
    // this build renders every turn itself.
    const virtualizer = useVirtualizer({
        count: virtualise ? turns.length : 0,
        getScrollElement: () => scrollRef.current,
        estimateSize: () => 210,
        getItemKey: (i) => turns[i]?.id ?? i,
        overscan: 4,
        // Pinning writes scrollTop from a layout effect, which lands the
        // virtualiser's notify inside React's commit where a synchronous flush
        // is refused.
        useFlushSync: false,
        useAnimationFrameWithResizeObserver: true,
    });
    const totalSize = virtualizer.getTotalSize();

    /** Turns prepended above the viewport would drag it down; heights vary, so
     *  the shift is measured rather than computed from a row size. */
    useLayoutEffect(() => {
        const el = scrollRef.current;
        if (!el || heightBefore.current === null) return;
        const grew = el.scrollHeight - heightBefore.current;
        heightBefore.current = null;
        if (grew > 0) el.scrollTop += grew;
    }, [turns.length]);

    /** Open at the end and stay there while the reader is. Skipped when already
     *  at the target, so a settling measurement cannot start a scroll cascade. */
    useLayoutEffect(() => {
        const el = scrollRef.current;
        if (!el || turns.length === 0) return;
        const target = el.scrollHeight - el.clientHeight;
        if (!didLand.current) {
            didLand.current = true;
            el.scrollTop = target;
            return;
        }
        if (atBottom.current && Math.abs(el.scrollTop - target) > 1) el.scrollTop = target;
    }, [turns.length, totalSize]);

    useEffect(() => {
        const root = scrollRef.current;
        if (!root) return;
        const top = new IntersectionObserver(([e]) => {
            atTop.current = e?.isIntersecting ?? false;
            if (atTop.current) void loadOlder();
        }, { root, rootMargin: "600px 0px 0px 0px" });
        const bottom = new IntersectionObserver(([e]) => {
            atBottom.current = e?.isIntersecting ?? false;
            if (!atBottom.current) return;
            if (counted.current !== 0) { counted.current = 0; setNewCount(0); }
        }, { root });
        if (topSentinel.current) top.observe(topSentinel.current);
        if (bottomSentinel.current) bottom.observe(bottomSentinel.current);
        return () => { top.disconnect(); bottom.disconnect(); };
    }, [loadOlder]);

    /** Settles following synchronously; an observer resolves a frame later,
     *  which is long enough for an arriving turn to pull the reader back. */
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

    /** An observer reports changes, so a request beginning while the top is
     *  already in view gets no event to follow it and paging would stop for
     *  good. The scroll check ends the chain once a prepend has pushed the top
     *  out of reach. */
    useEffect(() => {
        if (loadingOlder || reachedStart || !atTop.current) return;
        const el = scrollRef.current;
        if (el && el.scrollTop < 600) void loadOlder();
    }, [loadingOlder, reachedStart, turns.length, loadOlder]);

    const items = virtualizer.getVirtualItems();
    const mounted = virtualise ? items.length : turns.length;
    useEffect(() => {
        onStats({ loaded: turns.length, total, mounted, fetched: prefetched });
    }, [turns.length, total, mounted, prefetched, onStats]);
    useEffect(() => {
        onHeader({ history, arrived, loaded: turns.length });
    }, [history, arrived, turns.length, onHeader]);

    const toggle = async (t: TraceSummary) => {
        const isOpen = open[t._id];
        setOpen((o) => ({ ...o, [t._id]: !isOpen }));
        if (isOpen || spans[t._id]) return;
        setPending((p) => ({ ...p, [t._id]: true }));
        try {
            const full = await fetchTrace(t._id);
            setSpans((s) => ({ ...s, [t._id]: full.spans }));
        } finally {
            setPending((p) => ({ ...p, [t._id]: false }));
        }
    };

    const jumpToLatest = () => {
        const el = scrollRef.current;
        if (el) el.scrollTop = el.scrollHeight;
        counted.current = 0;
        setNewCount(0);
        atBottom.current = true;
    };

    const turnProps = (t: TraceSummary, index: number) => ({
        trace: t,
        spans: spans[t._id],
        loadingSpans: pending[t._id],
        expanded: Boolean(open[t._id]),
        onToggle: () => void toggle(t),
        highlighted: t._id === anchorId,
        divider: index > 0,
    });

    return (
        <div className="relative h-full">
            {/* Same reason as the list: the prepend below is compensated for
                explicitly, so the browser must not do it as well. */}
            <div
                ref={scrollRef}
                className="nl-scroll h-full overflow-auto px-6 py-5"
                style={{ overflowAnchor: "none" }}
                data-session-root
            >
                <div className="mx-auto w-full max-w-[960px]">
                    <div ref={topSentinel} className="h-px" />
                    {loadingOlder && turns.length > 0 && <TurnsSkeleton turns={2} />}
                    {reachedStart && !loadingOlder && (
                        <div className="py-3 text-center text-2xs text-muted-foreground/60">start of conversation</div>
                    )}

                    {turns.length === 0 && <TurnsSkeleton turns={4} />}
                    {virtualise ? (
                        <div style={{ height: totalSize, position: "relative" }}>
                            {items.map((item) => {
                                const t = turns[item.index];
                                if (!t) return null;
                                return (
                                    <div
                                        key={t.id}
                                        ref={virtualizer.measureElement}
                                        data-index={item.index}
                                        data-turn-id={t.id}
                                        style={{
                                            position: "absolute", top: 0, left: 0, width: "100%",
                                            transform: `translateY(${item.start}px)`,
                                        }}
                                    >
                                        <SessionTurn {...turnProps(t, item.index)} />
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        turns.map((t, i) => (
                            <div key={t.id} data-turn-id={t.id}>
                                <SessionTurn {...turnProps(t, i)} />
                            </div>
                        ))
                    )}

                    <div ref={bottomSentinel} className="h-px" />
                </div>
            </div>
            <NewArrivalsPill count={newCount} onClick={jumpToLatest} direction="down" />
        </div>
    );
}
