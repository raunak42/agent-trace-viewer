"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useTraceStream } from "@/lib/useTraceStream";
import { useViewMetrics, buildHistogram } from "@/lib/useViewMetrics";
import type { TraceSummary } from "@/lib/types";
import { TableHeader, TraceRow, ROW_HEIGHT } from "@/components/nl/TraceTable";
import { TopBar, FilterBar, Histogram, FooterBar, BuildSwitch } from "@/components/nl/Chrome";
import { TraceDetail } from "@/components/TraceDetail";
import { NewArrivalsPill } from "@/components/NewArrivalsPill";

const PAGE_SIZE = 50;

export default function OptimizedView() {
    const stream = useTraceStream({ projection: "list", batchMs: 150, view: "optimized", pageSize: PAGE_SIZE });
    const metrics = useViewMetrics("optimized");
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
        // prepending a page of history shifts every measurement onto the
        // wrong row.
        getItemKey: (index) => stream.traces[index]?.id ?? index,
        overscan: 12,
    });

    const loadOlderRef = useRef(stream.loadOlder);
    loadOlderRef.current = stream.loadOlder;

    // Pagination is driven by visibility, not by scroll events: a scroll
    // handler stops firing once scrollTop hits 0, which dead-ends the list.
    useEffect(() => {
        const el = topSentinel.current, root = scrollRef.current;
        if (!el || !root) return;
        const io = new IntersectionObserver(([e]) => {
            atTop.current = e?.isIntersecting ?? false;
            if (atTop.current && didInitialScroll.current) loadOlderRef.current();
        }, { root, rootMargin: "300px 0px 0px 0px", threshold: 0 });
        io.observe(el);
        return () => io.disconnect();
    }, []);

    useEffect(() => {
        const el = bottomSentinel.current, root = scrollRef.current;
        if (!el || !root) return;
        const io = new IntersectionObserver(([e]) => {
            atBottom.current = e?.isIntersecting ?? false;
            if (atBottom.current) setNewCount(0);
        }, { root, rootMargin: "0px 0px 200px 0px", threshold: 0 });
        io.observe(el);
        return () => io.disconnect();
    }, []);

    // A prepend grows the spacer above the viewport, so scrollTop has to move
    // by the height inserted or the reader is dragged toward the top.
    useLayoutEffect(() => {
        const el = scrollRef.current;
        if (!el || stream.delta.prepended <= 0) return;
        el.scrollTop += stream.delta.prepended * ROW_HEIGHT;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stream.delta.seq]);

    useEffect(() => {
        if (stream.loadingOlder || !stream.hasMore || !didInitialScroll.current) return;
        const el = scrollRef.current;
        if (atTop.current && el && el.scrollTop < ROW_HEIGHT * 10) loadOlderRef.current();
    }, [stream.loadingOlder, stream.hasMore, stream.delta.seq]);

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
    const hist = buildHistogram(stream.traces);

    return (
        <main className="flex h-dvh flex-col bg-background text-foreground">
            <BuildSwitch active="optimized" />
            <TopBar range={hist.range} />
            <FilterBar />
            <Histogram buckets={hist.buckets} labels={hist.labels} />
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
                                        <TraceRow
                                            trace={trace}
                                            selected={selected?.id === trace.id}
                                            onOpen={setSelected}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                        <div ref={bottomSentinel} className="h-px" />
                    </div>

                    {stream.loadingOlder && (
                        <div className="pointer-events-none absolute inset-x-0 top-10 py-1.5 text-center text-2xs text-muted-foreground">
                            loading older…
                        </div>
                    )}
                    {!stream.hasMore && stream.traces.length > 0 && !stream.loadingOlder && (
                        <div className="pointer-events-none absolute inset-x-0 top-10 py-1.5 text-center text-2xs text-muted-foreground/60">
                            start of buffer
                        </div>
                    )}
                    <NewArrivalsPill count={newCount} onClick={jumpToBottom} />
                </div>
                <TraceDetail summary={selected} view="optimized" onClose={() => setSelected(null)} />
            </div>
            <FooterBar
                pageSize={PAGE_SIZE}
                rows={stream.traces.length}
                rendered={items.length}
                domNodes={metrics.domNodes}
                commits={stream.commits}
                bytes={metrics.bytes}
                requests={metrics.requests}
                connection={stream.connection}
            />
        </main>
    );
}
