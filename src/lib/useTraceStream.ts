"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchHistory, WS_URL } from "./api";
import type { ServerMessage, TraceSummary } from "./types";

export type ConnectionState = "connecting" | "reconciling" | "live" | "reconnecting" | "error";

export interface StreamOptions {
    /** `list` omits spans (~0.6 KB/row); `session` sends the full document (~5.2 KB/row). */
    projection: "session" | "list";
    /** Milliseconds to batch incoming live messages before re-rendering. 0 renders per message. */
    batchMs: number;
    view: "naive" | "optimized";
    pageSize?: number;
}

/**
 * Where the rows in the latest commit landed. The store is sorted by id, so a
 * page of history lands at the front and live messages land at the back — and
 * the two need opposite scroll handling: a prepend must be compensated so the
 * viewport stays on the row the user was reading, while an append should only
 * move the viewport if the user is already parked at the bottom.
 *
 * `seq` increments on every commit so a layout effect still fires when the
 * counts happen to repeat.
 */
export interface InsertDelta {
    prepended: number;
    appended: number;
    seq: number;
}

export interface StreamState {
    traces: TraceSummary[];
    connection: ConnectionState;
    hasMore: boolean;
    loadingOlder: boolean;
    bootId: string | null;
    /** Counts every state commit, so the two views' re-render behaviour is comparable. */
    commits: number;
    delta: InsertDelta;
    loadOlder: () => void;
}

const NO_DELTA: InsertDelta = { prepended: 0, appended: 0, seq: 0 };

/**
 * Approach A: open the socket first, buffer whatever arrives, then load history
 * and merge. The reverse order can silently drop entries that land in the gap
 * between the history response and the socket opening; this way the worst case
 * is a duplicate, which dedupe-by-id removes.
 */
export function useTraceStream(options: StreamOptions): StreamState {
    const { projection, batchMs, view, pageSize = 50 } = options;

    const [traces, setTraces] = useState<TraceSummary[]>([]);
    const [connection, setConnection] = useState<ConnectionState>("connecting");
    const [hasMore, setHasMore] = useState(true);
    const [loadingOlder, setLoadingOlder] = useState(false);
    const [bootId, setBootId] = useState<string | null>(null);
    const [commits, setCommits] = useState(0);
    const [delta, setDelta] = useState<InsertDelta>(NO_DELTA);

    // Sorted ascending by id. Held in a ref so appends never depend on stale state.
    const store = useRef<TraceSummary[]>([]);
    const ids = useRef<Set<number>>(new Set());
    const preHistoryBuffer = useRef<TraceSummary[]>([]);
    const phase = useRef<"buffering" | "live">("buffering");
    const pending = useRef<TraceSummary[]>([]);
    const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const socket = useRef<WebSocket | null>(null);
    const closedByUs = useRef(false);
    const oldestId = useRef<number | null>(null);

    // Guards are mirrored into refs because `loadOlder` is called from an
    // IntersectionObserver callback, which would otherwise close over the
    // `loadingOlder`/`hasMore` values from the render that registered it.
    const loadingRef = useRef(false);
    const hasMoreRef = useRef(true);

    const commit = useCallback((d: { prepended: number; appended: number }) => {
        setTraces([...store.current]);
        setCommits((c) => c + 1);
        setDelta((prev) => ({ prepended: d.prepended, appended: d.appended, seq: prev.seq + 1 }));
    }, []);

    const insert = useCallback((incoming: TraceSummary[]) => {
        const oldestBefore = store.current[0]?.id;
        let prepended = 0;
        let appended = 0;

        for (const t of incoming) {
            if (ids.current.has(t.id)) continue;   // dedupe — duplicates are expected by design
            ids.current.add(t.id);
            store.current.push(t);
            if (oldestBefore !== undefined && t.id < oldestBefore) prepended += 1;
            else appended += 1;
        }

        if (prepended + appended === 0) return { prepended: 0, appended: 0 };
        store.current.sort((a, b) => a.id - b.id);
        oldestId.current = store.current[0]?.id ?? null;
        return { prepended, appended };
    }, []);

    /** Live appends are batched: a burst of messages costs one render, not N. */
    const enqueue = useCallback((trace: TraceSummary) => {
        if (batchMs <= 0) {
            const d = insert([trace]);
            if (d.prepended + d.appended > 0) commit(d);
            return;
        }
        pending.current.push(trace);
        if (flushTimer.current) return;
        flushTimer.current = setTimeout(() => {
            flushTimer.current = null;
            const batch = pending.current;
            pending.current = [];
            const d = insert(batch);
            if (d.prepended + d.appended > 0) commit(d);
        }, batchMs);
    }, [batchMs, insert, commit]);

    const loadOlder = useCallback(() => {
        if (loadingRef.current || !hasMoreRef.current || oldestId.current === null) return;
        loadingRef.current = true;
        setLoadingOlder(true);

        void (async () => {
            try {
                const page = await fetchHistory({
                    before: oldestId.current!, limit: pageSize, projection, view,
                });
                const d = insert(page.logs);
                hasMoreRef.current = page.hasMore;
                setHasMore(page.hasMore);
                if (d.prepended + d.appended > 0) commit(d);
            } catch {
                // A failed page is recoverable: the cursor is unchanged, so the
                // next time the top comes into view it retries.
            } finally {
                loadingRef.current = false;
                setLoadingOlder(false);
            }
        })();
    }, [pageSize, projection, view, insert, commit]);

    useEffect(() => {
        closedByUs.current = false;
        let retry: ReturnType<typeof setTimeout> | null = null;

        const connect = () => {
            const ws = new WebSocket(WS_URL);
            socket.current = ws;

            ws.onmessage = async (event) => {
                const msg = JSON.parse(event.data as string) as ServerMessage;

                if (msg.type === "connected") {
                    const isReconnect = store.current.length > 0;

                    // A different bootId means the server restarted or this is a
                    // different replica: local ids no longer refer to the same
                    // entries, so everything held must be discarded.
                    setBootId((prev) => {
                        if (prev && prev !== msg.bootId) {
                            store.current = [];
                            ids.current.clear();
                            oldestId.current = null;
                            hasMoreRef.current = true;
                            setHasMore(true);
                        }
                        return msg.bootId;
                    });

                    if (isReconnect) {
                        // Backfill only the gap, rather than reloading everything.
                        setConnection("reconciling");
                        const lastLocal = store.current[store.current.length - 1]?.id ?? 0;
                        if (msg.lastLogId > lastLocal) {
                            let cursor = lastLocal;
                            let total = { prepended: 0, appended: 0 };
                            for (let guard = 0; guard < 40; guard += 1) {
                                // `after` pages come back ascending, so the last
                                // entry is the newest and anchors the next page.
                                const gap = await fetchHistory({ after: cursor, limit: 100, projection, view });
                                if (gap.logs.length === 0) break;
                                const d = insert(gap.logs);
                                total = {
                                    prepended: total.prepended + d.prepended,
                                    appended: total.appended + d.appended,
                                };
                                cursor = gap.logs[gap.logs.length - 1]!.id;
                                if (cursor >= msg.lastLogId) break;
                            }
                            if (total.prepended + total.appended > 0) commit(total);
                        }
                        phase.current = "live";
                        setConnection("live");
                        return;
                    }

                    // First connection: history is requested only now, with anything
                    // that arrived in the meantime already captured in the buffer.
                    setConnection("reconciling");
                    try {
                        const history = await fetchHistory({
                            before: msg.lastLogId + 1, limit: pageSize, projection, view,
                        });
                        const a = insert(history.logs);
                        const b = insert(preHistoryBuffer.current);
                        preHistoryBuffer.current = [];
                        hasMoreRef.current = history.hasMore;
                        setHasMore(history.hasMore);
                        phase.current = "live";
                        commit({
                            prepended: a.prepended + b.prepended,
                            appended: a.appended + b.appended,
                        });
                        setConnection("live");
                    } catch {
                        setConnection("error");
                    }
                    return;
                }

                if (msg.type === "log") {
                    if (phase.current === "buffering") preHistoryBuffer.current.push(msg.data);
                    else enqueue(msg.data);
                }
            };

            ws.onclose = () => {
                if (closedByUs.current) return;
                setConnection("reconnecting");
                phase.current = "live";
                retry = setTimeout(connect, 1500);
            };
            ws.onerror = () => ws.close();
        };

        connect();
        return () => {
            closedByUs.current = true;
            if (retry) clearTimeout(retry);
            if (flushTimer.current) clearTimeout(flushTimer.current);
            socket.current?.close();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return { traces, connection, hasMore, loadingOlder, bootId, commits, delta, loadOlder };
}
