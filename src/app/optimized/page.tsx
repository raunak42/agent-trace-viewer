"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useTraceStream } from "@/lib/useTraceStream";
import type { TraceSummary } from "@/lib/types";
import { TraceRow } from "@/components/TraceRow";
import { TraceDetail } from "@/components/TraceDetail";
import { MetricsPanel } from "@/components/MetricsPanel";
import { NewArrivalsPill } from "@/components/NewArrivalsPill";
import { ViewSwitch } from "@/components/ViewSwitch";

const ROW_HEIGHT = 41;

export default function OptimizedView() {
    const stream = useTraceStream({ projection: "list", batchMs: 150, view: "optimized" });
    const [selected, setSelected] = useState<TraceSummary | null>(null);
    const [newCount, setNewCount] = useState(0);

    const scrollRef = useRef<HTMLDivElement>(null);
    const bottomSentinel = useRef<HTMLDivElement>(null);
    const atBottom = useRef(true);
    const lastSeen = useRef(0);
    const prevLength = useRef(0);

    const virtualizer = useVirtualizer({
        count: stream.traces.length,
        getScrollElement: () => scrollRef.current,
        estimateSize: () => ROW_HEIGHT,
        overscan: 12,
    });

    // "Am I at the bottom" comes from an observer on a sentinel, not from
    // measuring scrollTop on every pixel of movement.
    useEffect(() => {
        const el = bottomSentinel.current;
        if (!el) return;
        const io = new IntersectionObserver(
            ([entry]) => {
                atBottom.current = entry?.isIntersecting ?? false;
                if (atBottom.current) { setNewCount(0); lastSeen.current = stream.traces.length; }
            },
            { root: scrollRef.current, rootMargin: "200px 0px 0px 0px", threshold: 0 },
        );
        io.observe(el);
        return () => io.disconnect();
    }, [stream.traces.length]);

    // Stick to the bottom only while the user is already there.
    useLayoutEffect(() => {
        const grew = stream.traces.length - prevLength.current;
        prevLength.current = stream.traces.length;
        if (grew <= 0) return;
        if (atBottom.current) {
            virtualizer.scrollToIndex(stream.traces.length - 1, { align: "end" });
            lastSeen.current = stream.traces.length;
        } else {
            setNewCount(stream.traces.length - lastSeen.current);
        }
    }, [stream.traces.length, virtualizer]);

    // Land at the newest entry once history has merged.
    const didInitialScroll = useRef(false);
    useLayoutEffect(() => {
        if (didInitialScroll.current || stream.traces.length === 0) return;
        didInitialScroll.current = true;
        lastSeen.current = stream.traces.length;
        virtualizer.scrollToIndex(stream.traces.length - 1, { align: "end" });
    }, [stream.traces.length, virtualizer]);

    // Older pages load when the top of the window is approached. Throttled with
    // rAF so a fast scroll cannot queue dozens of fetches.
    const ticking = useRef(false);
    const onScroll = useCallback(() => {
        if (ticking.current) return;
        ticking.current = true;
        requestAnimationFrame(() => {
            ticking.current = false;
            const el = scrollRef.current;
            if (el && el.scrollTop < ROW_HEIGHT * 10) stream.loadOlder();
        });
    }, [stream]);

    const jumpToBottom = () => {
        virtualizer.scrollToIndex(stream.traces.length - 1, { align: "end", behavior: "smooth" });
        setNewCount(0);
        lastSeen.current = stream.traces.length;
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
                    <div ref={scrollRef} onScroll={onScroll} className="h-full overflow-auto" data-list-root>
                        {stream.loadingOlder && (
                            <div className="py-2 text-center text-[11px] text-white/35">loading older…</div>
                        )}
                        {!stream.hasMore && stream.traces.length > 0 && (
                            <div className="py-2 text-center text-[11px] text-white/25">start of buffer</div>
                        )}
                        <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
                            {items.map((item) => {
                                const trace = stream.traces[item.index];
                                if (!trace) return null;
                                return (
                                    <div
                                        key={trace.id}
                                        ref={virtualizer.measureElement}
                                        data-index={item.index}
                                        style={{ position: "absolute", top: 0, left: 0, width: "100%", transform: `translateY(${item.start}px)` }}
                                    >
                                        <TraceRow trace={trace} onOpen={setSelected} />
                                    </div>
                                );
                            })}
                        </div>
                        <div ref={bottomSentinel} className="h-1" />
                    </div>
                    <NewArrivalsPill count={newCount} onClick={jumpToBottom} />
                </div>
                <TraceDetail summary={selected} view="optimized" onClose={() => setSelected(null)} />
            </div>
        </main>
    );
}
