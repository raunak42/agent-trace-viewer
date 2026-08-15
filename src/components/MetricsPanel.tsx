"use client";

import { useEffect, useState } from "react";
import { stats } from "@/lib/api";

/**
 * Measures what actually differs between the two views: how many rows are in
 * the DOM, how many bytes were pulled, and how often React committed.
 */
export function MetricsPanel({ view, rows, rendered, commits, connection }: {
    view: "naive" | "optimized";
    rows: number;
    rendered: number;
    commits: number;
    connection: string;
}) {
    const [domNodes, setDomNodes] = useState(0);
    const [bytes, setBytes] = useState(0);
    const [requests, setRequests] = useState(0);

    useEffect(() => {
        const tick = () => {
            const list = document.querySelector("[data-list-root]");
            setDomNodes(list ? list.querySelectorAll("*").length : 0);
            setBytes(stats[view].bytes);
            setRequests(stats[view].requests);
        };
        tick();
        const id = setInterval(tick, 500);
        return () => clearInterval(id);
    }, [view]);

    const cell = (label: string, value: string, warn = false) => (
        <div className="px-3 py-1.5">
            <div className="text-[10px] uppercase tracking-wide text-white/35">{label}</div>
            <div className={`font-mono text-xs ${warn ? "text-amber-300" : "text-white/85"}`}>{value}</div>
        </div>
    );

    return (
        <div className="flex flex-wrap items-center divide-x divide-white/10 border-b border-white/10 bg-white/[0.03]">
            {cell("connection", connection)}
            {cell("rows in store", rows.toLocaleString())}
            {cell("rows in DOM", rendered.toLocaleString(), view === "naive" && rendered > 200)}
            {cell("DOM nodes", domNodes.toLocaleString(), view === "naive" && domNodes > 2000)}
            {cell("react commits", commits.toLocaleString(), view === "naive" && commits > 200)}
            {cell("fetched", `${(bytes / 1024).toFixed(0)} KB`, view === "naive" && bytes > 500_000)}
            {cell("requests", requests.toLocaleString())}
        </div>
    );
}
