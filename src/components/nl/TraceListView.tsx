"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useTraceStream } from "@/lib/useTraceStream";
import { fetchStats } from "@/lib/api";
import { TableHeader, TraceRow, ROW_HEIGHT } from "./TraceTable";
import { BuildSwitch } from "./Chrome";
import { StreamStats, useArrivalRate } from "./StreamStats";
import { NewArrivalsPill } from "../NewArrivalsPill";

const PAGE_SIZE = 50;

/**
 * The trace list, in both builds.
 *
 * One component on purpose. The socket, the projection, the page size, the
 * batching and the cursor are identical in both, so the two pull the same bytes
 * in the same requests and their counters move together.
 *
 * `virtualise` is the only difference. With it, the rows near the viewport are
 * mounted and the rest are a spacer; without it, every row loaded is in the
 * document. Keeping them in one file is what stops some other difference
 * creeping in and being read as the effect of virtualising.
 *
 * Newest-first, matching app.neatlogs.com: live rows arrive at the top and
 * history extends the bottom. That inverts the usual tail-follow logic — the
 * viewport sticks to the top, older pages load when the bottom comes into view,
 * and only insertions above the viewport need scroll compensation.
 */
export function TraceListView({ virtualise, view }: {
    virtualise: boolean;
    view: "optimized" | "naive";
}) {
    const stream = useTraceStream({ projection: "list", batchMs: 150, view, pageSize: PAGE_SIZE });
    const [history, setHistory] = useState<number | null>(null);
    useEffect(() => {
        let cancelled = false;
        fetchStats().then((s) => { if (!cancelled) setHistory(s.size); }).catch(() => {});
        return () => { cancelled = true; };
    }, []);
    const rate = useArrivalRate(stream.liveCount);
    const router = useRouter();
    const [newCount, setNewCount] = useState(0);

    const scrollRef = useRef<HTMLDivElement>(null);
    const topSentinel = useRef<HTMLDivElement>(null);
    const bottomSentinel = useRef<HTMLDivElement>(null);
    const atTop = useRef(true);
    const atBottom = useRef(false);

    // A hook, so always called; given nothing to do when this build renders
    // every row itself.
    const virtualizer = useVirtualizer({
        count: virtualise ? stream.traces.length : 0,
        getScrollElement: () => scrollRef.current,
        estimateSize: () => ROW_HEIGHT,
        // Without a stable key the size cache is addressed by index, so rows
        // arriving at the top would shift every measurement onto the wrong row.
        getItemKey: (index) => stream.traces[index]?.id ?? index,
        overscan: 12,
    });

    const loadOlderRef = useRef(stream.loadOlder);
    useEffect(() => { loadOlderRef.current = stream.loadOlder; });

    // Older pages live at the bottom, so that is what drives pagination.
    // Visibility rather than scroll events: a scroll handler stops firing once
    // the viewport stops moving, which dead-ends the list.
    useEffect(() => {
        const el = bottomSentinel.current, root = scrollRef.current;
        if (!el || !root) return;
        const io = new IntersectionObserver(([e]) => {
            atBottom.current = e?.isIntersecting ?? false;
            if (atBottom.current) loadOlderRef.current();
        }, { root, rootMargin: "0px 0px 400px 0px", threshold: 0 });
        io.observe(el);
        return () => io.disconnect();
    }, []);

    // The top is where new rows land, so it is what "am I following?" means.
    useEffect(() => {
        const el = topSentinel.current, root = scrollRef.current;
        if (!el || !root) return;
        const io = new IntersectionObserver(([e]) => {
            atTop.current = e?.isIntersecting ?? false;
            if (atTop.current) setNewCount(0);
        }, { root, threshold: 0 });
        io.observe(el);
        return () => io.disconnect();
    }, []);

    // Settles following synchronously: the observer resolves a frame later,
    // long enough for a batch to land and snap the reader back mid-gesture.
    useEffect(() => {
        const root = scrollRef.current;
        if (!root) return;
        const sync = () => {
            const following = root.scrollTop <= 0;
            atTop.current = following;
            if (following) setNewCount(0);
        };
        root.addEventListener("scroll", sync, { passive: true });
        return () => root.removeEventListener("scroll", sync);
    }, []);

    // Keep paging while the bottom is still in view after a page resolves.
    useEffect(() => {
        if (stream.loadingOlder || !stream.hasMore) return;
        if (atBottom.current) loadOlderRef.current();
    }, [stream.loadingOlder, stream.hasMore, stream.delta.seq]);

    useLayoutEffect(() => {
        const el = scrollRef.current;
        if (!el || stream.delta.addedAtTop <= 0) return;
        if (atTop.current) {
            el.scrollTop = 0;
            setNewCount(0);
        } else {
            // Rows inserted above would otherwise drag the viewport down by
            // exactly their height.
            el.scrollTop += stream.delta.addedAtTop * ROW_HEIGHT;
            setNewCount((n) => n + stream.delta.addedAtTop);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stream.delta.seq]);

    // Instant, not smooth: a smooth scroll passes through non-zero offsets, and
    // the listener above reads each of those as the reader taking control, so
    // the jump would cancel itself.
    const jumpToNewest = () => {
        const el = scrollRef.current;
        if (el) el.scrollTop = 0;
        setNewCount(0);
        atTop.current = true;
    };

    const items = virtualizer.getVirtualItems();
    const openTrace = (id: string) => router.push(`/traces/${id}`);

    return (
        <main className="flex h-dvh flex-col bg-background text-foreground">
            <StreamStats
                unit="traces"
                totalLabel="total logs"
                history={history}
                arrived={stream.liveCount}
                loaded={stream.traces.length}
                rate={rate}
                connection={stream.connection}
            />
            <BuildSwitch active={view} />
            <div className="flex min-h-0 flex-1 border-t border-border">
                <div className="relative flex min-w-0 flex-1 flex-col">
                    <TableHeader />
                    {/* The browser also keeps the viewport still when content
                        is inserted above it, and rows compensated for twice
                        drift by exactly their own height on every batch. Only
                        the unvirtualised build was affected — absolutely
                        positioned rows are not eligible as scroll anchors — so
                        the compensation below is the single source of truth for
                        both. */}
                    <div
                        ref={scrollRef}
                        className="nl-scroll min-h-0 flex-1 overflow-auto"
                        style={{ overflowAnchor: "none" }}
                        data-list-root
                    >
                        {virtualise ? (
                            <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
                                <div ref={topSentinel} className="absolute top-0 left-0 h-px w-full" />
                                {items.map((item) => {
                                    const trace = stream.traces[item.index];
                                    if (!trace) return null;
                                    return (
                                        <div
                                            key={trace.id}
                                            data-index={item.index}
                                            style={{
                                                position: "absolute", top: 0, left: 0, width: "100%",
                                                height: ROW_HEIGHT, transform: `translateY(${item.start}px)`,
                                            }}
                                        >
                                            <TraceRow trace={trace} onOpen={(t) => openTrace(t._id)} />
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <>
                                <div ref={topSentinel} className="h-px" />
                                {stream.traces.map((trace) => (
                                    <TraceRow key={trace.id} trace={trace} onOpen={(t) => openTrace(t._id)} />
                                ))}
                            </>
                        )}
                        <div ref={bottomSentinel} className="h-px" />
                        {/* Scrolls with the rows: older pages arrive at the end,
                            so this belongs there rather than pinned across the view. */}
                        {stream.loadingOlder && (
                            <div className="py-2 text-center text-2xs text-muted-foreground">loading older…</div>
                        )}
                        {!stream.hasMore && stream.traces.length > 0 && !stream.loadingOlder && (
                            <div className="py-2 text-center text-2xs text-muted-foreground/60">start of buffer</div>
                        )}
                    </div>
                    <NewArrivalsPill count={newCount} onClick={jumpToNewest} />
                </div>
            </div>
        </main>
    );
}
