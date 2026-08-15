"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTraceStream } from "@/lib/useTraceStream";
import { useViewMetrics, buildHistogram } from "@/lib/useViewMetrics";
import { TableHeader, TraceRow, ROW_HEIGHT } from "@/components/nl/TraceTable";
import { TopBar, FilterBar, Histogram, FooterBar, BuildSwitch } from "@/components/nl/Chrome";

const PAGE_SIZE = 50;

/**
 * Same chrome, same rows, same reconciliation — correctness is not the variable
 * being demonstrated. What differs:
 *
 *   1. every row is mounted, so the DOM grows without bound
 *   2. `projection=session` pulls full documents with spans (~5.2 KB vs ~0.6 KB)
 *   3. no batching, so each live message triggers its own React commit
 *   4. pagination fires from a raw scroll handler on every event
 *   5. new data yanks the viewport to the bottom wherever the user was reading
 */
export default function NaiveView() {
    const stream = useTraceStream({ projection: "session", batchMs: 0, view: "naive", pageSize: PAGE_SIZE });
    const metrics = useViewMetrics("naive", true);
    const router = useRouter();
    const scrollRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        // History still has to stay reachable, so a prepend is compensated here
        // too — otherwise the viewport lands at scrollTop 0 and the scroll
        // handler below has no event left to fire on.
        if (stream.delta.prepended > 0) el.scrollTop += stream.delta.prepended * ROW_HEIGHT;
        // The anti-pattern: any new row drags the viewport down, regardless of
        // where the reader was.
        if (stream.delta.appended > 0) el.scrollTop = el.scrollHeight;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stream.delta.seq]);

    // Unthrottled: runs on every scroll event.
    const onScroll = () => {
        const el = scrollRef.current;
        if (el && el.scrollTop < 400) stream.loadOlder();
    };

    const hist = buildHistogram(stream.traces);

    return (
        <main className="flex h-dvh flex-col bg-background text-foreground">
            <BuildSwitch active="naive" />
            <TopBar range={hist.range} />
            <FilterBar />
            <Histogram buckets={hist.buckets} labels={hist.labels} />
            <div className="flex min-h-0 flex-1 border-t border-border">
                <div className="relative flex min-w-0 flex-1 flex-col">
                    <TableHeader />
                    <div
                        ref={scrollRef}
                        onScroll={onScroll}
                        className="nl-scroll min-h-0 flex-1 overflow-auto"
                        style={{ overflowAnchor: "none" }}
                        data-list-root
                    >
                        {stream.loadingOlder && (
                            <div className="py-1.5 text-center text-2xs text-muted-foreground">loading older…</div>
                        )}
                        {stream.traces.map((trace) => (
                            <TraceRow
                                key={trace.id}
                                trace={trace}
                                onOpen={(t) => router.push(`/traces/${t._id}`)}
                            />
                        ))}
                    </div>
                </div>
            </div>
            <FooterBar
                pageSize={PAGE_SIZE}
                rows={stream.traces.length}
                rendered={stream.traces.length}
                domNodes={metrics.domNodes}
                commits={stream.commits}
                bytes={metrics.bytes}
                requests={metrics.requests}
                connection={stream.connection}
                fps={metrics.fps}
            />
        </main>
    );
}
