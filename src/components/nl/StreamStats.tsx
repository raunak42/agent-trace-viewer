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
            marks.current.push({ t: now, n: latest.current });
            while (marks.current.length > 2 && now - marks.current[0]!.t > 8000) marks.current.shift();
            const first = marks.current[0];
            const last = marks.current[marks.current.length - 1]!;
            const seconds = (last.t - first!.t) / 1000;
            setRate(seconds > 0 ? (last.n - first!.n) / seconds : 0);
        }, 1000);
        return () => clearInterval(id);
    }, []);

    return rate;
}

const fmt = (n: number) => n.toLocaleString();

/**
 * The four numbers that describe what is being watched, in the words someone
 * would use to ask: how much was already there, how fast is more arriving, how
 * much has this page actually pulled down, and what does that add up to now.
 */
export function StreamStats({ unit, history, arrived, loaded, rate, note }: {
    /** "traces" or "turns" — what one item is on this page. */
    unit: string;
    /** How many existed server-side when this page first fetched. */
    history: number | null;
    /** How many have arrived live since then. */
    arrived: number;
    /** How many this page has actually pulled down. */
    loaded: number;
    rate: number;
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

    return (
        <div className="flex shrink-0 items-center gap-0 overflow-x-auto border-b border-border py-3">
            {cell("in history", history === null ? "…" : fmt(history), `${unit} before you opened`)}
            <span className="h-9 w-px shrink-0 bg-border" />
            {cell("arriving", `${rate.toFixed(1)}/s`, `new ${unit} per second`)}
            <span className="h-9 w-px shrink-0 bg-border" />
            {cell("loaded", fmt(loaded), `${unit} pulled so far`)}
            <span className="h-9 w-px shrink-0 bg-border" />
            {cell("total now", history === null ? "…" : fmt(history + arrived), `history + ${fmt(arrived)} new`, true)}
            {note && <span className="ml-auto pr-6 text-2xs text-muted-foreground/60">{note}</span>}
        </div>
    );
}
