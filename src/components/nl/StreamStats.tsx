"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Rate over a short trailing window rather than an average since opening, so
 * it reflects what is happening now instead of slowly forgetting a pause.
 */
export function useArrivalRate(total: number): number {
    const [rate, setRate] = useState(0);
    const marks = useRef<Array<{ t: number; n: number }>>([]);
    // Synced in an effect rather than during render, which is not allowed
    // for refs.
    const latest = useRef(total);
    useEffect(() => { latest.current = total; }, [total]);

    useEffect(() => {
        const id = setInterval(() => {
            const now = Date.now();
            const n = latest.current;
            // A counter that goes backwards was reset, and the marks taken
            // before it describe a different run. Switching builds remounts the
            // view that owns the count while this hook lives on the page above
            // and keeps its window, so subtracting across the reset reported a
            // negative arrival rate. The earlier marks are dropped instead.
            const previous = marks.current[marks.current.length - 1];
            if (previous && n < previous.n) marks.current = [];
            marks.current.push({ t: now, n });
            while (marks.current.length > 2 && now - marks.current[0]!.t > 8000) marks.current.shift();
            const first = marks.current[0]!;
            const last = marks.current[marks.current.length - 1]!;
            const seconds = (last.t - first.t) / 1000;
            // Arrivals only accumulate, so the floor holds the invariant no
            // matter which way the count is fed in.
            setRate(seconds > 0 ? Math.max(0, (last.n - first.n) / seconds) : 0);
        }, 1000);
        return () => clearInterval(id);
    }, []);

    return rate;
}

const fmt = (n: number) => n.toLocaleString();

/**
 * Three numbers, each answering a different question: how much exists, how fast
 * more is arriving, and how much of it this page has actually pulled down.
 *
 * History is reported live — what the server held when this page first fetched,
 * plus everything that has arrived since — rather than as the frozen figure
 * from that first fetch. The snapshot was a detail of when the page loaded, and
 * showing it alongside the running total gave two numbers for one question.
 */
export function StreamStats({ unit, history, arrived, loaded, rate, totalLabel, connection, note }: {
    /** "traces" or "turns" — what one item is on this page. */
    unit: string;
    /** How many existed server-side when this page first fetched. Added to
     *  `arrived` to report the live total. */
    history: number | null;
    /** How many have arrived live since then. */
    arrived: number;
    /** How many this page has actually pulled down. */
    loaded: number;
    rate: number;
    /** What to call the running total. Defaults to the unit, since "logs" reads
     *  oddly for the turns of one conversation. */
    totalLabel?: string;
    /** Socket state. Omitted where the page already reports liveness of its
     *  own — the transcript's session pill says whether that thread is still
     *  receiving, which is a narrower claim than the connection being up. */
    connection?: string;
    note?: string;
}) {
    const cell = (label: string, value: string, sub: string, accent = false) => (
        <div className="flex min-w-0 flex-col gap-0.5 px-5 first:pl-6">
            <span className="text-2xs tracking-wide text-muted-foreground/70 uppercase">{label}</span>
            <span className={`font-mono text-[26px] leading-none tabular-nums ${accent ? "text-foreground" : "text-foreground/85"}`}>
                {value}
            </span>
            <span className="text-2xs text-muted-foreground/60">{sub}</span>
        </div>
    );

    const total = history === null ? null : history + arrived;

    return (
        <div className="flex shrink-0 items-center gap-0 overflow-x-auto border-b border-border py-3">
            {cell(totalLabel ?? `total ${unit}`, total === null ? "…" : fmt(total), "history + new arrivals", true)}
            <span className="h-9 w-px shrink-0 bg-border" />
            {cell("arriving", `${rate.toFixed(1)}/s`, `new ${unit} per second`)}
            <span className="h-9 w-px shrink-0 bg-border" />
            {cell("loaded", fmt(loaded), `${unit} pulled by this page`)}
            {connection && (
                <>
                    <span className="h-9 w-px shrink-0 bg-border" />
                    {/* Sits with the figures rather than pushed to the far edge:
                        it qualifies them, so it belongs beside them. */}
                    <span className="flex shrink-0 items-center gap-2 px-5">
                        <span className={`size-2 rounded-full ${
                            connection === "live" ? "animate-pulse bg-success" : "bg-muted-foreground/40"}`} />
                        <span className="text-xs tracking-wide text-muted-foreground uppercase">{connection}</span>
                    </span>
                </>
            )}
            {note && <span className="ml-auto pr-6 text-2xs text-muted-foreground/60">{note}</span>}
        </div>
    );
}
