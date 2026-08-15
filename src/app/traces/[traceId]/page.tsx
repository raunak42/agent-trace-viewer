"use client";

import { Suspense, use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { fetchTrace } from "@/lib/api";
import { useViewMetrics } from "@/lib/useViewMetrics";
import type { Trace } from "@/lib/types";
import { SessionOptimized } from "@/components/nl/SessionOptimized";
import { SessionNaive } from "@/components/nl/SessionNaive";
import { ChevronDownIcon, ChevronLeftIcon, SlidersIcon } from "@/components/nl/icons";

type Build = "optimized" | "naive";

/**
 * Their row click is a route, not a panel: /traces/{traceId} opens the whole
 * session the trace belongs to, rendered as a transcript of turns. This serves
 * both builds off the same route so the two can be compared on one session.
 */
function SessionPage({ traceId }: { traceId: string }) {
    const params = useSearchParams();
    const build: Build = params.get("build") === "naive" ? "naive" : "optimized";

    // Keyed by the id it was fetched for, so switching trace clears the old
    // one without a synchronous setState at the top of the effect.
    const [loaded, setLoaded] = useState<{ id: string; anchor: Trace | null; error: string | null }>(
        { id: "", anchor: null, error: null },
    );
    const [stats, setStats] = useState({ loaded: 0, total: 0, mounted: 0 });
    const metrics = useViewMetrics(build, build === "naive");

    useEffect(() => {
        let cancelled = false;
        fetchTrace(traceId, build)
            .then((t) => { if (!cancelled) setLoaded({ id: traceId, anchor: t, error: null }); })
            .catch((e) => { if (!cancelled) setLoaded({ id: traceId, anchor: null, error: String(e?.message ?? e) }); });
        return () => { cancelled = true; };
    }, [traceId, build]);

    const anchor = loaded.id === traceId ? loaded.anchor : null;
    const error = loaded.id === traceId ? loaded.error : null;

    const onStats = useCallback((s: typeof stats) => setStats(s), []);

    const stamp = anchor
        ? new Date(anchor.ts).toLocaleString("en-GB", {
              day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true,
          })
        : "";

    const tab = (b: Build, label: string, sub: string) => (
        <Link
            href={`/traces/${traceId}?build=${b}`}
            className={`flex flex-col justify-center border-b-2 px-4 py-2 transition-colors ${
                build === b ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
        >
            <span className="text-[13px] leading-4 font-medium">{label}</span>
            <span className="text-2xs text-muted-foreground/70">{sub}</span>
        </Link>
    );

    return (
        <main className="flex h-dvh flex-col bg-background text-foreground">
            <div className="flex h-12 shrink-0 items-center gap-1 border-b border-border px-4">
                {tab("optimized", "Virtualised", "list projection · spans on open")}
                {tab("naive", "Unoptimised", "every turn · full documents")}
            </div>

            <header className="flex h-[68px] shrink-0 items-center justify-between border-b border-border px-4">
                <div className="flex min-w-0 items-center gap-3">
                    <Link href="/optimized" aria-label="Back to traces"
                        className="flex size-8 shrink-0 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-muted">
                        <ChevronLeftIcon className="size-4" />
                    </Link>
                    <button type="button" className="flex cursor-pointer items-center gap-1.5 text-[15px] text-foreground">
                        {stamp}
                        <ChevronDownIcon className="size-4 text-muted-foreground" />
                    </button>
                    {anchor && (
                        <span className="flex items-center gap-2 rounded-xl border border-border px-3 py-1.5 text-[13px]">
                            <span className="text-foreground">session</span>
                            <span className="font-mono text-xs tabular-nums text-muted-foreground">
                                {stats.total || "…"} turns
                            </span>
                        </span>
                    )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    <button type="button"
                        className="flex h-9 cursor-pointer items-center gap-2 rounded-full bg-[#18181b] px-4 text-[13px] font-medium text-white transition-colors hover:bg-[#27272a]">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                            <path d="M8 5v14l11-7z" />
                        </svg>
                        Watch replay
                    </button>
                    <button type="button" aria-label="Display preferences"
                        className="flex size-9 cursor-pointer items-center justify-center rounded-lg border border-border text-foreground transition-colors hover:bg-muted">
                        <SlidersIcon />
                    </button>
                </div>
            </header>

            <div className="min-h-0 flex-1">
                {error && <div className="p-6 text-[13px] text-destructive">{error}</div>}
                {!anchor && !error && <div className="p-6 text-[13px] text-muted-foreground">Loading session…</div>}
                {anchor && build === "optimized" && (
                    <SessionOptimized sessionId={anchor.sessionId} anchorId={anchor._id} onStats={onStats} />
                )}
                {anchor && build === "naive" && (
                    <SessionNaive sessionId={anchor.sessionId} anchorId={anchor._id} onStats={onStats} />
                )}
            </div>

            <div className="flex h-12 shrink-0 items-center justify-end gap-5 overflow-x-auto border-t border-border px-6">
                {([["turns loaded", `${stats.loaded}/${stats.total || "?"}`],
                   ["turns mounted", stats.mounted],
                   ["dom nodes", metrics.domNodes.toLocaleString()],
                   ["fetched", `${(metrics.bytes / 1024).toFixed(0)} KB`],
                   ["requests", metrics.requests]] as const).map(([k, v]) => (
                    <span key={k} className="flex items-baseline gap-1.5 whitespace-nowrap">
                        <span className="text-2xs text-muted-foreground/70 uppercase">{k}</span>
                        <span className="font-mono text-xs tabular-nums text-foreground/85">{v}</span>
                    </span>
                ))}
                {build === "naive" && (
                    <span className="flex items-baseline gap-1.5">
                        <span className="text-2xs text-muted-foreground/70 uppercase">fps</span>
                        <span className="font-mono text-xs tabular-nums text-foreground/85">{metrics.fps}</span>
                    </span>
                )}
            </div>
        </main>
    );
}

export default function Page({ params }: { params: Promise<{ traceId: string }> }) {
    const { traceId } = use(params);
    return (
        <Suspense fallback={<div className="p-6 text-[13px] text-muted-foreground">Loading…</div>}>
            <SessionPage traceId={traceId} />
        </Suspense>
    );
}
