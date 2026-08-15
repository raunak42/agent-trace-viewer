"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTraceStream } from "@/lib/useTraceStream";
import type { TraceSummary } from "@/lib/types";
import { TraceRow } from "@/components/TraceRow";
import { TraceDetail } from "@/components/TraceDetail";
import { MetricsPanel } from "@/components/MetricsPanel";
import { ViewSwitch } from "@/components/ViewSwitch";

/**
 * The unoptimised comparison. Reconciliation is identical to the optimised view
 * — correctness is not the variable being demonstrated. What differs:
 *
 *   1. every row is mounted, so the DOM grows without bound
 *   2. `projection=session` pulls full documents with spans (~5.2 KB vs ~0.6 KB)
 *   3. no batching, so each live message triggers its own React commit
 *   4. pagination fires from a raw scroll handler on every event
 */
export default function NaiveView() {
    const stream = useTraceStream({ projection: "session", batchMs: 0, view: "naive" });
    const [selected, setSelected] = useState<TraceSummary | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const prevLength = useRef(0);
    const [fps, setFps] = useState(60);

    // Frame rate makes the cost visible: the naive list drops frames as it grows.
    useEffect(() => {
        let frames = 0, last = performance.now(), raf = 0;
        const loop = () => {
            frames += 1;
            const now = performance.now();
            if (now - last >= 1000) { setFps(frames); frames = 0; last = now; }
            raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(raf);
    }, []);

    // Always scrolls down on new data, regardless of where the user is.
    useLayoutEffect(() => {
        if (stream.traces.length === prevLength.current) return;
        prevLength.current = stream.traces.length;
        const el = scrollRef.current;
        if (el) el.scrollTop = el.scrollHeight;
    }, [stream.traces.length]);

    // Unthrottled: runs on every scroll event.
    const onScroll = () => {
        const el = scrollRef.current;
        if (el && el.scrollTop < 400) stream.loadOlder();
    };

    return (
        <main className="flex h-dvh flex-col bg-[#0a0d12] text-white">
            <ViewSwitch active="naive" />
            <MetricsPanel
                view="naive"
                rows={stream.traces.length}
                rendered={stream.traces.length}
                commits={stream.commits}
                connection={stream.connection}
            />
            <div className="border-b border-amber-500/20 bg-amber-500/5 px-3 py-1.5 text-[11px] text-amber-300/90">
                Unoptimised: every row mounted · full documents with spans · a React commit per message · unthrottled scroll
                <span className="ml-3 font-mono">{fps} fps</span>
            </div>
            <div className="flex min-h-0 flex-1">
                <div
                    ref={scrollRef}
                    onScroll={onScroll}
                    className="min-w-0 flex-1 overflow-auto"
                    data-list-root
                >
                    {stream.loadingOlder && <div className="py-2 text-center text-[11px] text-white/35">loading older…</div>}
                    {stream.traces.map((trace) => (
                        <TraceRow key={trace.id} trace={trace} onOpen={setSelected} />
                    ))}
                </div>
                <TraceDetail summary={selected} view="naive" onClose={() => setSelected(null)} />
            </div>
        </main>
    );
}
