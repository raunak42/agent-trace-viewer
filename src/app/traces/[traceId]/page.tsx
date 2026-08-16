"use client";

import { Suspense, use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { fetchSessionList, fetchSessionPage, fetchTrace } from "@/lib/api";
import type { Trace } from "@/lib/types";
import { SessionView } from "@/components/nl/SessionView";
import { StreamStats, useArrivalRate } from "@/components/nl/StreamStats";
import { ChevronLeftIcon } from "@/components/nl/icons";
import { TurnsSkeleton } from "@/components/nl/Skeleton";
import { type Build, BUILDS, isBuild } from "@/lib/builds";


/** capacity ÷ ingest rate, i.e. how long a trace stays resolvable. */
const RETENTION_HOURS = Math.round(140_000 / 5 / 3600);

/**
 * Their row click is a route, not a panel: /traces/{traceId} opens the whole
 * session the trace belongs to, rendered as a transcript of turns. This serves
 * all three builds off the same route so they can be compared on one session.
 */
function SessionPage({ traceId }: { traceId: string }) {
    const params = useSearchParams();
    const router = useRouter();
    const q = params.get("build");
    const build: Build = isBuild(q) ? q : "windowed";

    // Keyed by the id it was fetched for, so switching trace clears the old
    // one without a synchronous setState at the top of the effect.
    const [loaded, setLoaded] = useState<{ id: string; anchor: Trace | null; error: string | null }>(
        { id: "", anchor: null, error: null },
    );
    const [stats, setStats] = useState({ loaded: 0, total: 0, mounted: 0 });
    const [tail, setTail] = useState({ kept: 0, discarded: 0, bytes: 0 });
    const [header, setHeader] = useState<{ history: number | null; arrived: number; loaded: number }>(
        { history: null, arrived: 0, loaded: 0 },
    );
    const rate = useArrivalRate(header.arrived);

    useEffect(() => {
        let cancelled = false;
        fetchTrace(traceId)
            .then((t) => { if (!cancelled) setLoaded({ id: traceId, anchor: t, error: null }); })
            .catch((e) => { if (!cancelled) setLoaded({ id: traceId, anchor: null, error: String(e?.message ?? e) }); });
        return () => { cancelled = true; };
    }, [traceId, build]);

    const anchor = loaded.id === traceId ? loaded.anchor : null;
    const error = loaded.id === traceId ? loaded.error : null;

    // Both children report by value, so a fresh object arrives on every call
    // even when nothing has moved. Storing it unconditionally re-renders the
    // page, which re-renders the child, which recomputes how many rows are
    // mounted, which reports again — a loop React eventually refuses. Keeping
    // the previous object when the numbers match breaks it.
    const onStats = useCallback((s: typeof stats) => {
        setStats((prev) =>
            prev.loaded === s.loaded && prev.total === s.total && prev.mounted === s.mounted ? prev : s);
    }, []);
    const onHeader = useCallback((h: typeof header) => {
        setHeader((prev) =>
            prev.history === h.history && prev.arrived === h.arrived && prev.loaded === h.loaded ? prev : h);
    }, []);
    const onTail = useCallback((t: typeof tail) => {
        setTail((prev) =>
            prev.kept === t.kept && prev.discarded === t.discarded && prev.bytes === t.bytes ? prev : t);
    }, []);

    // A thread that has finished simply stops, which is indistinguishable from
    // a broken page unless the view says which it is.
    const [lastActivity, setLastActivity] = useState(() => Date.now());
    const [now, setNow] = useState(() => Date.now());
    const seenKept = useRef(0);
    useEffect(() => {
        if (tail.kept > seenKept.current) { seenKept.current = tail.kept; setLastActivity(Date.now()); }
    }, [tail.kept]);
    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), 2000);
        return () => clearInterval(t);
    }, []);
    const idleSeconds = Math.round((now - lastActivity) / 1000);
    const streaming = idleSeconds < 30;
    // "Ended" would be a claim we cannot make: silence on this subscription
    // means no turns have arrived, not that the thread is finished.
    const idleLabel = idleSeconds < 90
        ? `idle ${idleSeconds}s`
        : `idle ${Math.floor(idleSeconds / 60)}m ${idleSeconds % 60}s`;

    const [jumping, setJumping] = useState(false);
    const jumpToLiveSession = async () => {
        setJumping(true);
        try {
            const { sessions } = await fetchSessionList(5);
            const target = sessions.find((s) => s.live && s.sessionId !== anchor?.sessionId) ?? sessions[0];
            if (!target) return;
            const page = await fetchSessionPage(target.sessionId, { limit: 1, projection: "list" });
            const first = page.logs[0];
            if (first) router.push(`/traces/${first._id}?build=${build}`);
        } finally {
            setJumping(false);
        }
    };

    const stamp = anchor
        ? new Date(anchor.ts).toLocaleString("en-GB", {
              day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true,
          })
        : "";

    const tab = (b: Build, label: string, sub: string) => (
        <Link
            key={b}
            href={`/traces/${traceId}?build=${b}`}
            className={`-mb-px flex flex-col justify-center border-b-2 px-4 py-2 transition-colors ${
                build === b ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
        >
            <span className="text-[13px] leading-4 font-medium">{label}</span>
            <span className="text-2xs text-muted-foreground/70">{sub}</span>
        </Link>
    );

    return (
        <main className="flex h-dvh flex-col bg-background text-foreground">
            <StreamStats
                unit="turns"
                history={header.history}
                arrived={header.arrived}
                loaded={header.loaded}
                rate={rate}
                note="one conversation"
            />
            <div className="flex shrink-0 items-stretch gap-1 border-b border-border px-4">
                {BUILDS.map((b) => tab(b.id, b.label, b.note))}
            </div>

            <header className="flex h-[68px] shrink-0 items-center justify-between border-b border-border px-4">
                <div className="flex min-w-0 items-center gap-3">
                    <Link href={`/${build}`} aria-label="Back to traces"
                        className="flex size-8 shrink-0 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-muted">
                        <ChevronLeftIcon className="size-4" />
                    </Link>
                    <span className="text-[15px] text-foreground">{stamp}</span>
                    {anchor && (
                        <span className="flex items-center gap-2 rounded-xl border border-border px-3 py-1.5 text-[13px]">
                            <span className="text-foreground">session</span>
                            <span className="font-mono text-xs tabular-nums text-muted-foreground">
                                {stats.total || "…"} turns
                            </span>
                            <span className={`size-1.5 rounded-full ${streaming ? "animate-pulse bg-success" : "bg-muted-foreground/40"}`} />
                            <span className="text-2xs text-muted-foreground uppercase">
                                {streaming ? "live" : idleLabel}
                            </span>
                        </span>
                    )}
                    {anchor && !streaming && (
                        <button
                            type="button"
                            onClick={() => void jumpToLiveSession()}
                            disabled={jumping}
                            className="cursor-pointer rounded-lg border border-border px-3 py-1.5 text-[13px] text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                        >
                            {jumping ? "finding…" : "Open an active session"}
                        </button>
                    )}
                </div>
            </header>

            <div className="min-h-0 flex-1">
                {error && (
                    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                        <div className="text-[15px] text-foreground">This trace is no longer in the buffer</div>
                        <div className="max-w-[440px] text-[13px] text-muted-foreground">
                            The stream keeps a rolling window — about {RETENTION_HOURS} hours at the current
                            rate — and drops the oldest trace for each new one. A restart clears it entirely.
                            The link was valid; the data behind it has aged out.
                        </div>
                        <button
                            type="button"
                            onClick={() => void jumpToLiveSession()}
                            disabled={jumping}
                            className="mt-1 cursor-pointer rounded-lg border border-border px-3.5 py-2 text-[13px] text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                        >
                            {jumping ? "finding…" : "Open an active session"}
                        </button>
                        <code className="mt-1 font-mono text-2xs text-muted-foreground/50">{traceId}</code>
                    </div>
                )}
                {!anchor && !error && (
                    <div className="h-full overflow-hidden px-6 py-5">
                        <div className="mx-auto w-full max-w-[960px]"><TurnsSkeleton turns={4} /></div>
                    </div>
                )}
                {anchor && (
                    <SessionView
                        key={build}
                        sessionId={anchor.sessionId}
                        anchorId={anchor._id}
                        build={build}
                        onStats={onStats}
                        onTail={onTail}
                        onHeader={onHeader}
                    />
                )}
            </div>

        </main>
    );
}

export default function Page({ params }: { params: Promise<{ traceId: string }> }) {
    const { traceId } = use(params);
    return (
        <Suspense fallback={
            <main className="flex h-dvh flex-col bg-background px-6 py-5">
                <div className="mx-auto w-full max-w-[960px]"><TurnsSkeleton turns={4} /></div>
            </main>
        }>
            <SessionPage traceId={traceId} />
        </Suspense>
    );
}
