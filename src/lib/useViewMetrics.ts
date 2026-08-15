"use client";

import { useEffect, useState } from "react";
import { stats } from "./api";
import type { TraceSummary } from "./types";

/** Polls the things that can only be observed from the DOM, once a second. */
export function useViewMetrics(view: "naive" | "optimized", withFps = false) {
    const [m, setM] = useState({ domNodes: 0, bytes: 0, requests: 0, fps: 60 });

    useEffect(() => {
        let frames = 0, last = performance.now(), raf = 0, fps = 60;
        const loop = () => {
            frames += 1;
            const now = performance.now();
            if (now - last >= 1000) { fps = frames; frames = 0; last = now; }
            raf = requestAnimationFrame(loop);
        };
        if (withFps) raf = requestAnimationFrame(loop);

        const t = setInterval(() => {
            const root = document.querySelector("[data-list-root]") ?? document.querySelector("[data-session-root]");
            const next = {
                domNodes: root ? root.getElementsByTagName("*").length : 0,
                bytes: stats[view].bytes,
                requests: stats[view].requests,
                fps,
            };
            // Publishing a fresh object every tick re-renders the page whether
            // or not anything moved. On a view holding hundreds of thousands of
            // nodes that render is expensive enough that the updates stack up,
            // and React refuses the chain.
            setM((prev) =>
                prev.domNodes === next.domNodes && prev.bytes === next.bytes
                    && prev.requests === next.requests && prev.fps === next.fps
                    ? prev : next);
        }, 1000);

        return () => { clearInterval(t); if (raf) cancelAnimationFrame(raf); };
    }, [view, withFps]);

    return m;
}

const BUCKETS = 28;

/** Volume over the loaded window, shaped for the header histogram. */
export function buildHistogram(traces: TraceSummary[]) {
    if (traces.length === 0) {
        return { buckets: new Array(BUCKETS).fill(0), labels: ["", "", "", "", "", "", ""], range: "—" };
    }
    const first = traces[0]!.ts;
    const last = traces[traces.length - 1]!.ts;
    const span = Math.max(1, last - first);
    const buckets = new Array<number>(BUCKETS).fill(0);
    for (const t of traces) {
        const i = Math.min(BUCKETS - 1, Math.floor(((t.ts - first) / span) * BUCKETS));
        buckets[i] += 1;
    }
    const at = (frac: number) =>
        new Date(first + span * frac).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
    const day = (ms: number) => new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return {
        buckets,
        labels: [0, 1 / 6, 2 / 6, 3 / 6, 4 / 6, 5 / 6, 1].map(at),
        range: day(first) === day(last) ? `${day(first)}` : `${day(first)} - ${day(last)}`,
    };
}
