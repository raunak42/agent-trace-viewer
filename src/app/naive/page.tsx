"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTraceStream } from "@/lib/useTraceStream";
import type { TraceSummary } from "@/lib/types";
import { TraceRow } from "@/components/TraceRow";
import { TraceDetail } from "@/components/TraceDetail";
import { MetricsPanel } from "@/components/MetricsPanel";
import { ViewSwitch } from "@/components/ViewSwitch";

const ROW_HEIGHT = 41;

/**
 * The unoptimised comparison. Reconciliation is identical to the optimised view
 * — correctness is not the variable being demonstrated. What differs:
 *
 *   1. every row is mounted, so the DOM grows without bound
 *   2. `projection=session` pulls full documents with spans (~5.2 KB vs ~0.6 KB)
 *   3. no batching, so each live message triggers its own React commit
 *   4. pagination fires from a raw scroll handler on every event
 *   5. new data yanks the viewport to the bottom wherever the user happens to be
 */
export default function NaiveView() {
    const stream = useTraceStream({ projection: "session", batchMs: 0, view: "naive" });
    const [selected, setSelected] = useState<TraceSummary | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
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

    useLayoutEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        // History still has to stay reachable, so a prepend is compensated here
        // too — otherwise the viewport lands at scrollTop 0 and the scroll
        // handler below has no event left to fire on.
        if (stream.delta.prepended > 0) el.scrollTop += stream.delta.prepended * ROW_HEIGHT;
        // The anti-pattern being demonstrated: any new row drags the viewport
        // down, regardless of where the user was reading.
        if (stream.delta.appended > 0) el.scrollTop = el.scrollHeight;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stream.delta.seq]);

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
                    style={{ overflowAnchor: "none" }}
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
