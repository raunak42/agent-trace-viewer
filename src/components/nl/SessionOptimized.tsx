"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { fetchSessionPage, fetchTrace } from "@/lib/api";
import { useSessionTail } from "@/lib/useSessionTail";
import type { Span, TraceSummary } from "@/lib/types";
import { SessionTurn } from "./SessionTurn";

const PAGE = 50;

/**
 * The optimised session view. Three things keep a 900-turn session cheap:
 *
 *   1. turns arrive as the list projection (~0.75 KB) instead of full
 *      documents (~3.9 KB), so the first page is 36 KB rather than 3.5 MB
 *   2. only the turns near the viewport are mounted
 *   3. a turn's spans are fetched when it is opened, never up front
 */
export function SessionOptimized({ sessionId, anchorId, onStats, onTail }: {
    sessionId: string;
    anchorId: string;
    onStats: (s: { loaded: number; total: number; mounted: number }) => void;
    onTail: (t: { kept: number; discarded: number; bytes: number }) => void;
}) {
    const [turns, setTurns] = useState<TraceSummary[]>([]);
    const [total, setTotal] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [spans, setSpans] = useState<Record<string, Span[]>>({});
    const [pending, setPending] = useState<Record<string, boolean>>({});
    const [open, setOpen] = useState<Record<string, boolean>>({});

    const scrollRef = useRef<HTMLDivElement>(null);
    const bottom = useRef<HTMLDivElement>(null);
    const loading = useRef(false);
    const cursor = useRef<number | undefined>(undefined);
    const hasMoreRef = useRef(true);

    const loadMore = useCallback(async () => {
        if (loading.current || !hasMoreRef.current) return;
        loading.current = true;
        try {
            const page = await fetchSessionPage(sessionId, {
                after: cursor.current, limit: PAGE, projection: "list", view: "optimized",
            });
            cursor.current = page.nextCursor ?? cursor.current;
            hasMoreRef.current = page.hasMore;
            setHasMore(page.hasMore);
            setTotal(page.total);
            setTurns((prev) => {
                const seen = new Set(prev.map((t) => t.id));
                return [...prev, ...page.logs.filter((t) => !seen.has(t.id))];
            });
        } finally {
            loading.current = false;
        }
    }, [sessionId]);

    useEffect(() => { void loadMore(); }, [loadMore]);

    // Turns arriving live are appended in place. The subscription is scoped to
    // this session and to summaries, so nothing arrives that has to be dropped.
    const tail = useSessionTail({
        sessionId,
        filtered: true,
        onTurn: (turn) => {
            setTurns((prev) => (prev.some((t) => t.id === turn.id) ? prev : [...prev, turn]));
            setTotal((n) => n + 1);
        },
    });
    useEffect(() => { onTail(tail); }, [tail, onTail]);

    const virtualizer = useVirtualizer({
        count: turns.length,
        getScrollElement: () => scrollRef.current,
        // Turns vary in height, so the estimate is a starting point and each
        // mounted row reports its real size back.
        estimateSize: () => 210,
        getItemKey: (i) => turns[i]?.id ?? i,
        overscan: 4,
    });

    // Paging is driven by the sentinel's visibility, not by scroll events.
    useEffect(() => {
        const el = bottom.current, root = scrollRef.current;
        if (!el || !root) return;
        const io = new IntersectionObserver(([e]) => {
            if (e?.isIntersecting) void loadMore();
        }, { root, rootMargin: "0px 0px 600px 0px" });
        io.observe(el);
        return () => io.disconnect();
    }, [loadMore]);

    const items = virtualizer.getVirtualItems();
    useEffect(() => {
        onStats({ loaded: turns.length, total, mounted: items.length });
    }, [turns.length, total, items.length, onStats]);

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

    return (
        <div ref={scrollRef} className="nl-scroll h-full overflow-auto px-6 py-5" data-session-root>
            <div className="mx-auto w-full max-w-[960px]">
                <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
                    {items.map((item) => {
                        const t = turns[item.index];
                        if (!t) return null;
                        return (
                            <div
                                key={t.id}
                                ref={virtualizer.measureElement}
                                data-index={item.index}
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
                <div ref={bottom} className="h-px" />
                {hasMore && <div className="py-3 text-center text-2xs text-muted-foreground">loading more turns…</div>}
            </div>
        </div>
    );
}
