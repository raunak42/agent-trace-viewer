"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useTraceStream } from "@/lib/useTraceStream";
import type { TraceSummary } from "@/lib/types";
import { TraceRow } from "@/components/TraceRow";
import { TraceDetail } from "@/components/TraceDetail";
import { MetricsPanel } from "@/components/MetricsPanel";
import { NewArrivalsPill } from "@/components/NewArrivalsPill";
import { ViewSwitch } from "@/components/ViewSwitch";

/** Rows are a single uniform line: py-2.5 (20) + line-height (20) + border (1). */
const ROW_HEIGHT = 41;

export default function OptimizedView() {
    const stream = useTraceStream({ projection: "list", batchMs: 150, view: "optimized" });
    const [selected, setSelected] = useState<TraceSummary | null>(null);
    const [newCount, setNewCount] = useState(0);

    const scrollRef = useRef<HTMLDivElement>(null);
    const topSentinel = useRef<HTMLDivElement>(null);
    const bottomSentinel = useRef<HTMLDivElement>(null);
    const atBottom = useRef(true);
    const atTop = useRef(false);
    const didInitialScroll = useRef(false);

    const virtualizer = useVirtualizer({
        count: stream.traces.length,
        getScrollElement: () => scrollRef.current,
        estimateSize: () => ROW_HEIGHT,
        // Without a stable key the size cache is addressed by index, so
        // prepending a page of history would shift every cached measurement
        // onto the wrong row.
        getItemKey: (index) => stream.traces[index]?.id ?? index,
        overscan: 12,
    });

    // `loadOlder` is read through a ref so the observers below can be registered
    // once instead of being torn down and rebuilt on every commit.
    const loadOlderRef = useRef(stream.loadOlder);
    loadOlderRef.current = stream.loadOlder;

    // Pagination is driven by an IntersectionObserver, not a scroll handler.
    // A scroll handler only runs while the wheel is actually moving the
    // viewport, so once scrollTop reaches 0 no further events fire and the list
    // dead-ends. An observer reports visibility, which is the real condition.
    useEffect(() => {
        const el = topSentinel.current;
        const root = scrollRef.current;
        if (!el || !root) return;
        const io = new IntersectionObserver(
            ([entry]) => {
                atTop.current = entry?.isIntersecting ?? false;
                if (atTop.current && didInitialScroll.current) loadOlderRef.current();
            },
            { root, rootMargin: "300px 0px 0px 0px", threshold: 0 },
        );
        io.observe(el);
        return () => io.disconnect();
    }, []);

    // "Am I at the bottom" also comes from an observer rather than measuring
    // scrollTop on every pixel of movement. Registered once — recreating it per
    // commit would mean six observer teardowns a second on a live stream.
    useEffect(() => {
        const el = bottomSentinel.current;
        const root = scrollRef.current;
        if (!el || !root) return;
        const io = new IntersectionObserver(
            ([entry]) => {
                atBottom.current = entry?.isIntersecting ?? false;
                if (atBottom.current) setNewCount(0);
            },
            { root, rootMargin: "0px 0px 200px 0px", threshold: 0 },
        );
        io.observe(el);
        return () => io.disconnect();
    }, []);

    // Prepending history grows the spacer above the viewport, so the browser's
    // unchanged scrollTop now points at different content. Pushing scrollTop
    // down by exactly the height that was inserted keeps the user on the row
    // they were reading — and restores the room above them to scroll into.
    useLayoutEffect(() => {
        const el = scrollRef.current;
        if (!el || stream.delta.prepended <= 0) return;
        el.scrollTop += stream.delta.prepended * ROW_HEIGHT;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stream.delta.seq]);

    // If a page was not tall enough to push the sentinel back out of view, keep
    // going. Bounded by the scrollTop check, so it stops as soon as the top of
    // the window is genuinely off screen.
    useEffect(() => {
        if (stream.loadingOlder || !stream.hasMore || !didInitialScroll.current) return;
        const el = scrollRef.current;
        if (atTop.current && el && el.scrollTop < ROW_HEIGHT * 10) loadOlderRef.current();
    }, [stream.loadingOlder, stream.hasMore, stream.delta.seq]);

    // Stick to the bottom only while the user is already there, and only for
    // rows that actually arrived at the bottom.
    useLayoutEffect(() => {
        if (stream.delta.appended <= 0) return;
        if (atBottom.current) {
            virtualizer.scrollToIndex(stream.traces.length - 1, { align: "end" });
            setNewCount(0);
        } else {
            setNewCount((n) => n + stream.delta.appended);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stream.delta.seq]);

    // Land at the newest entry once history has merged.
    useLayoutEffect(() => {
        if (didInitialScroll.current || stream.traces.length === 0) return;
        didInitialScroll.current = true;
        virtualizer.scrollToIndex(stream.traces.length - 1, { align: "end" });
    }, [stream.traces.length, virtualizer]);

    const jumpToBottom = () => {
        virtualizer.scrollToIndex(stream.traces.length - 1, { align: "end", behavior: "smooth" });
        setNewCount(0);
        atBottom.current = true;
    };

    const items = virtualizer.getVirtualItems();

    return (
        <main className="flex h-dvh flex-col bg-[#0a0d12] text-white">
            <ViewSwitch active="optimized" />
            <MetricsPanel
                view="optimized"
                rows={stream.traces.length}
                rendered={items.length}
                commits={stream.commits}
                connection={stream.connection}
            />
            <div className="flex min-h-0 flex-1">
                <div className="relative min-w-0 flex-1">
                    <div ref={scrollRef} className="h-full overflow-auto" data-list-root>
                        <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
                            {/* Absolutely positioned so the trigger never adds
                                height of its own to the scroll content. */}
                            <div ref={topSentinel} className="absolute left-0 top-0 h-px w-full" />
                            {items.map((item) => {
                                const trace = stream.traces[item.index];
                                if (!trace) return null;
                                return (
                                    <div
                                        key={trace.id}
                                        data-index={item.index}
                                        style={{
                                            position: "absolute", top: 0, left: 0, width: "100%",
                                            height: ROW_HEIGHT,
                                            transform: `translateY(${item.start}px)`,
                                        }}
                                    >
                                        <TraceRow trace={trace} onOpen={setSelected} />
                                    </div>
                                );
                            })}
                        </div>
                        <div ref={bottomSentinel} className="h-px" />
                    </div>

                    {/* Overlaid rather than inlined: a status row inside the
                        scroll content shifts every position when it appears. */}
                    {stream.loadingOlder && (
                        <div className="pointer-events-none absolute inset-x-0 top-0 py-1.5 text-center text-[11px] text-white/45 [text-shadow:0_1px_4px_#0a0d12]">
                            loading older…
                        </div>
                    )}
                    {!stream.hasMore && stream.traces.length > 0 && !stream.loadingOlder && (
                        <div className="pointer-events-none absolute inset-x-0 top-0 py-1.5 text-center text-[11px] text-white/25 [text-shadow:0_1px_4px_#0a0d12]">
                            start of buffer
                        </div>
                    )}
                    <NewArrivalsPill count={newCount} onClick={jumpToBottom} />
                </div>
                <TraceDetail summary={selected} view="optimized" onClose={() => setSelected(null)} />
            </div>
        </main>
    );
}
