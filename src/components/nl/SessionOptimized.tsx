"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { fetchSessionPage, fetchTrace } from "@/lib/api";
import { useSessionTail } from "@/lib/useSessionTail";
import type { Span, TraceSummary } from "@/lib/types";
import { SessionTurn } from "./SessionTurn";
import { NewArrivalsPill } from "../NewArrivalsPill";

const PAGE = 50;

/**
 * The optimised session view, read like a chat log: it opens on the turn you
 * arrived at — which for a row clicked off the top of the list is the live end
 * of the conversation — pages history upward as you scroll back, and appends
 * new turns at the bottom as they happen.
 *
 * Three things keep a 2,000-turn session cheap:
 *
 *   1. turns arrive as the list projection (~0.75 KB) rather than full
 *      documents (~3.9 KB)
 *   2. only the turns near the viewport are mounted
 *   3. a turn's spans are fetched when it is opened, never up front
 */
export function SessionOptimized({ sessionId, anchorId, onStats, onTail, onHeader }: {
    sessionId: string;
    anchorId: string;
    onStats: (s: { loaded: number; total: number; mounted: number }) => void;
    onTail: (t: { kept: number; discarded: number; bytes: number }) => void;
    onHeader: (h: { history: number | null; arrived: number; loaded: number }) => void;
}) {
    const [turns, setTurns] = useState<TraceSummary[]>([]);
    const [total, setTotal] = useState(0);
    /** Turns in this session when the page first fetched it, and turns that
     *  have arrived since — kept apart so the header can say what was already
     *  there rather than only what it now holds. */
    const [history, setHistory] = useState<number | null>(null);
    const [arrived, setArrived] = useState(0);
    const [spans, setSpans] = useState<Record<string, Span[]>>({});
    const [pending, setPending] = useState<Record<string, boolean>>({});
    const [open, setOpen] = useState<Record<string, boolean>>({});
    const [newCount, setNewCount] = useState(0);
    /** Mirrors newCount so handlers can tell whether a reset is a no-op. */
    const counted = useRef(0);

    const scrollRef = useRef<HTMLDivElement>(null);
    const topSentinel = useRef<HTMLDivElement>(null);
    const bottomSentinel = useRef<HTMLDivElement>(null);
    const atBottom = useRef(true);

    const busy = useRef(false);
    const oldest = useRef<number | undefined>(undefined);
    const newest = useRef<number | undefined>(undefined);
    const moreOlder = useRef(true);
    const moreNewer = useRef(true);
    const didLand = useRef(false);
    /** Height before a prepend, so the viewport can be held in place after it. */
    const heightBefore = useRef<number | null>(null);

    const ids = useRef<Set<number>>(new Set());
    const addTurns = (incoming: TraceSummary[], side: "older" | "newer") => {
        const fresh = incoming.filter((t) => !ids.current.has(t.id));
        if (fresh.length === 0) return 0;
        for (const t of fresh) ids.current.add(t.id);
        setTurns((prev) => (side === "older" ? [...fresh, ...prev] : [...prev, ...fresh]));
        return fresh.length;
    };

    /**
     * Opens on the newest turns, not on the one that was clicked. A thread is
     * read where it currently is, the way a chat opens on the latest message —
     * and anchoring to an older turn strands the live end behind hundreds of
     * unloaded turns, so nothing arriving could be shown. The clicked turn is
     * still highlighted once scrolling back reaches it.
     */
    useEffect(() => {
        let cancelled = false;
        (async () => {
            const page = await fetchSessionPage(sessionId, {
                before: Number.MAX_SAFE_INTEGER, limit: PAGE, projection: "list", view: "optimized",
            });
            if (cancelled) return;
            for (const t of page.logs) ids.current.add(t.id);
            setTurns(page.logs);
            setTotal(page.total);
            setHistory(page.total);
            oldest.current = page.logs[0]?.id;
            newest.current = page.logs[page.logs.length - 1]?.id;
            moreOlder.current = page.logs.length === PAGE;
            // The last page is loaded, so live turns attach immediately.
            moreNewer.current = false;
        })();
        return () => { cancelled = true; };
    }, [sessionId]);

    const loadOlder = useCallback(async () => {
        if (busy.current || !moreOlder.current || oldest.current === undefined) return;
        busy.current = true;
        heightBefore.current = scrollRef.current?.scrollHeight ?? null;
        try {
            const page = await fetchSessionPage(sessionId, {
                before: oldest.current, limit: PAGE, projection: "list", view: "optimized",
            });
            if (page.logs.length === 0) { moreOlder.current = false; return; }
            oldest.current = page.logs[0]?.id ?? oldest.current;
            if (page.logs.length < PAGE) moreOlder.current = false;
            if (addTurns(page.logs, "older") === 0) moreOlder.current = false;
        } finally {
            busy.current = false;
        }
    }, [sessionId]);

    const loadNewer = useCallback(async () => {
        if (busy.current || !moreNewer.current || newest.current === undefined) return;
        busy.current = true;
        try {
            const page = await fetchSessionPage(sessionId, {
                after: newest.current, limit: PAGE, projection: "list", view: "optimized",
            });
            if (page.logs.length === 0) { moreNewer.current = false; return; }
            newest.current = page.logs[page.logs.length - 1]?.id ?? newest.current;
            moreNewer.current = page.hasMore;
            addTurns(page.logs, "newer");
        } finally {
            busy.current = false;
        }
    }, [sessionId]);

    // Live turns belong at the bottom, but only once the bottom is actually
    // loaded — otherwise they would sit next to turns they do not follow.
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

    const virtualizer = useVirtualizer({
        count: turns.length,
        getScrollElement: () => scrollRef.current,
        estimateSize: () => 210,
        getItemKey: (i) => turns[i]?.id ?? i,
        overscan: 4,
        // Writing scrollTop from a layout effect — which pinning to the latest
        // turn requires — lands the virtualizer's notify inside React's commit,
        // and its default synchronous flush errors there. Scheduling the
        // re-render normally costs at most a frame of catch-up while scrolling.
        useFlushSync: false,
        useAnimationFrameWithResizeObserver: true,
    });

    const totalSize = virtualizer.getTotalSize();

    // Turns prepended above the viewport would otherwise drag it down. Heights
    // vary here, so the shift is measured rather than computed from a row size.
    // Runs before the pin below, and the two are mutually exclusive anyway:
    // one applies when reading history, the other when following the end.
    useLayoutEffect(() => {
        const el = scrollRef.current;
        if (!el || heightBefore.current === null) return;
        const grew = el.scrollHeight - heightBefore.current;
        heightBefore.current = null;
        if (grew > 0) el.scrollTop += grew;
    }, [turns.length]);

    // Open on the latest turn and stay there while the reader is at the end.
    // scrollTop is written directly rather than through scrollToIndex: that
    // path triggers a synchronous measurement flush, which React rejects from
    // inside a lifecycle. Re-runs as sizes settle, since an estimate can leave
    // it short of the true bottom.
    //
    // The write is skipped when already at the target. This effect fires on
    // every change to the virtualiser's total size, and that size keeps moving
    // as rows are measured — so writing unconditionally raises a scroll event,
    // which shifts the visible range, which measures more rows, which changes
    // the size again. Writing only when the position is actually wrong ends
    // that cycle after one pass.
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
            if (e?.isIntersecting) void loadOlder();
        }, { root, rootMargin: "600px 0px 0px 0px" });
        // No margin: following the end stops the moment the transcript is
        // scrolled, rather than after 600px of tolerance.
        const bottom = new IntersectionObserver(([e]) => {
            atBottom.current = e?.isIntersecting ?? false;
            if (!atBottom.current) return;
            if (counted.current !== 0) { counted.current = 0; setNewCount(0); }
            void loadNewer();
        }, { root });
        if (topSentinel.current) top.observe(topSentinel.current);
        if (bottomSentinel.current) bottom.observe(bottomSentinel.current);
        return () => { top.disconnect(); bottom.disconnect(); };
    }, [loadOlder, loadNewer]);

    // The observer resolves a frame later, which is long enough for an arriving
    // turn to pull the reader back mid-gesture. This settles it synchronously;
    // passive, and writes a ref, so it costs no render. Turn heights vary and
    // the content grows underneath, so "at the end" carries a few pixels of
    // slack rather than requiring an exact match.
    useEffect(() => {
        const root = scrollRef.current;
        if (!root) return;
        const sync = () => {
            const following = root.scrollHeight - root.clientHeight - root.scrollTop <= 4;
            atBottom.current = following;
            // Only when it would change something: pinning writes scrollTop,
            // which raises a scroll event, which lands back here.
            if (following && counted.current !== 0) { counted.current = 0; setNewCount(0); }
        };
        root.addEventListener("scroll", sync, { passive: true });
        return () => root.removeEventListener("scroll", sync);
    }, []);

    const items = virtualizer.getVirtualItems();
    useEffect(() => {
        onStats({ loaded: turns.length, total, mounted: items.length });
    }, [turns.length, total, items.length, onStats]);
    useEffect(() => {
        onHeader({ history, arrived, loaded: turns.length });
    }, [history, arrived, turns.length, onHeader]);

    const toggle = async (t: TraceSummary) => {
        const isOpen = open[t._id];
        setOpen((o) => ({ ...o, [t._id]: !isOpen }));
        if (isOpen || spans[t._id]) return;
        setPending((p) => ({ ...p, [t._id]: true }));
        try {
            const full = await fetchTrace(t._id, "optimized");
            setSpans((s) => ({ ...s, [t._id]: full.spans }));
        } finally {
            setPending((p) => ({ ...p, [t._id]: false }));
        }
    };

    // Instant for the same reason as the list: turns arriving during a smooth
    // scroll move the target while the animation is still chasing it.
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
                    <div ref={topSentinel} className="h-px" />
                    {moreOlder.current && (
                        <div className="py-3 text-center text-2xs text-muted-foreground">loading earlier turns…</div>
                    )}
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
                                    <SessionTurn
                                        trace={t}
                                        spans={spans[t._id]}
                                        loadingSpans={pending[t._id]}
                                        expanded={Boolean(open[t._id])}
                                        onToggle={() => void toggle(t)}
                                        highlighted={t._id === anchorId}
                                        divider={item.index > 0}
                                    />
                                </div>
                            );
                        })}
                    </div>
                    <div ref={bottomSentinel} className="h-px" />
                </div>
            </div>
            <NewArrivalsPill count={newCount} onClick={jumpToLatest} direction="down" />
        </div>
    );
}
