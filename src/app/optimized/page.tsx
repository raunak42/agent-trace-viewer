"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useTraceStream } from "@/lib/useTraceStream";
import { fetchStats } from "@/lib/api";
import { TableHeader, TraceRow, ROW_HEIGHT } from "@/components/nl/TraceTable";
import { BuildSwitch } from "@/components/nl/Chrome";
import { StreamStats, useArrivalRate } from "@/components/nl/StreamStats";
import { NewArrivalsPill } from "@/components/NewArrivalsPill";

const PAGE_SIZE = 50;

/**
 * Newest-first, matching app.neatlogs.com: live rows arrive at the top and
 * history extends the bottom. That inverts the usual tail-follow logic — the
 * viewport sticks to the top, older pages load when the bottom comes into
 * view, and only insertions above the viewport need scroll compensation.
 */
export default function OptimizedView() {
    const stream = useTraceStream({ projection: "list", batchMs: 150, view: "optimized", pageSize: PAGE_SIZE });
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

    const virtualizer = useVirtualizer({
        count: stream.traces.length,
        getScrollElement: () => scrollRef.current,
        estimateSize: () => ROW_HEIGHT,
        // Without a stable key the size cache is addressed by index, so rows
        // arriving at the top would shift every measurement onto the wrong row.
        getItemKey: (index) => stream.traces[index]?.id ?? index,
        overscan: 12,
    });

    const loadOlderRef = useRef(stream.loadOlder);
    useEffect(() => { loadOlderRef.current = stream.loadOlder; });

    // Older pages now live at the bottom, so that is what drives pagination.
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
    // No margin: following ends the moment the list is scrolled at all, rather
    // than after some tolerance, so a deliberate scroll is never overridden.
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

    // The observer resolves a frame later, which is long enough for a batch to
    // land and snap the reader back to the top mid-gesture. This settles it
    // synchronously; it is passive and writes a ref, so it costs no render.
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
            // Following the stream: stay pinned to the newest row.
            el.scrollTop = 0;
            setNewCount(0);
        } else {
            // Reading history: rows inserted above would otherwise drag the
            // viewport down by exactly their height.
            el.scrollTop += stream.delta.addedAtTop * ROW_HEIGHT;
            setNewCount((n) => n + stream.delta.addedAtTop);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stream.delta.seq]);

    // Instant, not smooth: a smooth scroll passes through non-zero offsets, and
    // the listener above reads each of those as the reader taking control, so
    // the jump cancels itself. Rows arriving mid-animation fight it too.
    const jumpToNewest = () => {
        const el = scrollRef.current;
        if (el) el.scrollTop = 0;
        setNewCount(0);
        atTop.current = true;
    };

    const items = virtualizer.getVirtualItems();

    return (
        <main className="flex h-dvh flex-col bg-background text-foreground">
            <StreamStats
                unit="traces"
                history={history}
                arrived={stream.liveCount}
                loaded={stream.traces.length}
                rate={rate}
                connection={stream.connection}
            />
            <BuildSwitch active="optimized" />
            {/* Page title, search, date range and filter chips: all faithful to
                their layout and all inert here, since this view tails one live
                stream rather than querying a window. Kept as a comment so the
                chrome can come back if the demo ever needs to look complete.
            <TopBar range={hist.range} />
            <FilterBar /> */}
            {/* Volume-over-time chart, commented out rather than removed.
                The loaded window is only ever a page or two of rows — fifteen
                seconds at five a second — so every bucket lands in the same
                minute and all seven axis labels read identically. It would
                only mean something over a window of hours.
            <Histogram buckets={hist.buckets} labels={hist.labels} /> */}
            <div className="flex min-h-0 flex-1 border-t border-border">
                <div className="relative flex min-w-0 flex-1 flex-col">
                    <TableHeader />
                    <div ref={scrollRef} className="nl-scroll min-h-0 flex-1 overflow-auto" data-list-root>
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
                                        <TraceRow trace={trace} onOpen={(t) => router.push(`/traces/${t._id}`)} />
                                    </div>
                                );
                            })}
                        </div>
                        <div ref={bottomSentinel} className="h-px" />
                        {/* Scrolls with the rows rather than floating over them:
                            older pages arrive at the bottom, so this belongs at
                            the end of the content, not pinned across the view. */}
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
