"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchHistory, fetchLogsBulk, WS_URL } from "./api";
import type { ServerMessage, TraceSummary } from "./types";

export type ConnectionState = "connecting" | "reconciling" | "live" | "reconnecting" | "error";

export interface StreamOptions {
    /** `list` omits spans (~0.6 KB/row); `session` sends the full document (~5.2 KB/row). */
    projection: "session" | "list";
    /** Milliseconds to batch incoming live messages before re-rendering. 0 renders per message. */
    batchMs: number;
    /** When set, the first load asks the unpaginated endpoint for this many
     *  rows in one request instead of taking a cursor page. Nothing else
     *  changes: the socket and the paging behind it are the same. */
    bulk?: number;
    pageSize?: number;
}

/**
 * Where the rows in the latest commit landed, in view order rather than id
 * order. The list is newest-first, matching app.neatlogs.com, so live messages
 * arrive at the top and history pages extend the bottom. The two need opposite
 * handling: rows added above the viewport must be compensated for so the
 * reader stays on the row they were reading, while rows added below cost
 * nothing and need no adjustment.
 *
 * `seq` increments on every commit so a layout effect still fires when the
 * counts happen to repeat.
 */
export interface InsertDelta {
    /** Newer rows, inserted above what is on screen. */
    addedAtTop: number;
    /** Older rows, appended below what is on screen. */
    addedAtBottom: number;
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
    /** Rows that arrived live since this page connected, as opposed to rows
     *  pulled from history. Newest-first ordering means live rows land at the
     *  top, so they are exactly the ones counted above the viewport. */
    liveCount: number;
    delta: InsertDelta;
    loadOlder: () => void;
}

const NO_DELTA: InsertDelta = { addedAtTop: 0, addedAtBottom: 0, seq: 0 };

/**
 * Approach A: open the socket first, buffer whatever arrives, then load history
 * and merge. The reverse order can silently drop entries that land in the gap
 * between the history response and the socket opening; this way the worst case
 * is a duplicate, which dedupe-by-id removes.
 */
export function useTraceStream(options: StreamOptions): StreamState {
    const { projection, batchMs, bulk, pageSize = 50 } = options;

    const [traces, setTraces] = useState<TraceSummary[]>([]);
    const [connection, setConnection] = useState<ConnectionState>("connecting");
    const [hasMore, setHasMore] = useState(true);
    const [loadingOlder, setLoadingOlder] = useState(false);
    const [bootId, setBootId] = useState<string | null>(null);
    const [commits, setCommits] = useState(0);
    const [liveCount, setLiveCount] = useState(0);
    const [delta, setDelta] = useState<InsertDelta>(NO_DELTA);

    // Sorted descending by id — index 0 is the newest row, which is what the
    // view renders first. Held in a ref so appends never depend on stale state.
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

    const commit = useCallback((d: { addedAtTop: number; addedAtBottom: number }) => {
        setTraces([...store.current]);
        setCommits((c) => c + 1);
        if (d.addedAtTop > 0) setLiveCount((n) => n + d.addedAtTop);
        setDelta((prev) => ({ addedAtTop: d.addedAtTop, addedAtBottom: d.addedAtBottom, seq: prev.seq + 1 }));
    }, []);

    const insert = useCallback((incoming: TraceSummary[]) => {
        const newestBefore = store.current[0]?.id;
        let addedAtTop = 0;
        let addedAtBottom = 0;

        for (const t of incoming) {
            if (ids.current.has(t.id)) continue;   // dedupe — duplicates are expected by design
            ids.current.add(t.id);
            store.current.push(t);
            if (newestBefore !== undefined && t.id > newestBefore) addedAtTop += 1;
            else addedAtBottom += 1;
        }

        if (addedAtTop + addedAtBottom === 0) return { addedAtTop: 0, addedAtBottom: 0 };
        store.current.sort((a, b) => b.id - a.id);
        // Descending, so the oldest row — the cursor for the next page — is last.
        oldestId.current = store.current[store.current.length - 1]?.id ?? null;
        return { addedAtTop, addedAtBottom };
    }, []);

    /** Live appends are batched: a burst of messages costs one render, not N. */
    const enqueue = useCallback((trace: TraceSummary) => {
        if (batchMs <= 0) {
            const d = insert([trace]);
            if (d.addedAtTop + d.addedAtBottom > 0) commit(d);
            return;
        }
        pending.current.push(trace);
        if (flushTimer.current) return;
        flushTimer.current = setTimeout(() => {
            flushTimer.current = null;
            const batch = pending.current;
            pending.current = [];
            const d = insert(batch);
            if (d.addedAtTop + d.addedAtBottom > 0) commit(d);
        }, batchMs);
    }, [batchMs, insert, commit]);

    const loadOlder = useCallback(() => {
        if (loadingRef.current || !hasMoreRef.current || oldestId.current === null) return;
        loadingRef.current = true;
        setLoadingOlder(true);

        void (async () => {
            try {
                const page = await fetchHistory({
                    before: oldestId.current!, limit: pageSize, projection,
                });
                const d = insert(page.logs);
                hasMoreRef.current = page.hasMore;
                setHasMore(page.hasMore);
                if (d.addedAtTop + d.addedAtBottom > 0) commit(d);
            } catch {
                // A failed page is recoverable: the cursor is unchanged, so the
                // next time the top comes into view it retries.
            } finally {
                loadingRef.current = false;
                setLoadingOlder(false);
            }
        })();
    }, [pageSize, projection, insert, commit]);

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
                        const lastLocal = store.current[0]?.id ?? 0;   // descending: newest first
                        if (msg.lastLogId > lastLocal) {
                            let cursor = lastLocal;
                            let total = { addedAtTop: 0, addedAtBottom: 0 };
                            for (let guard = 0; guard < 40; guard += 1) {
                                // `after` pages come back ascending, so the last
                                // entry is the newest and anchors the next page.
                                const gap = await fetchHistory({ after: cursor, limit: 100, projection });
                                if (gap.logs.length === 0) break;
                                const d = insert(gap.logs);
                                total = {
                                    addedAtTop: total.addedAtTop + d.addedAtTop,
                                    addedAtBottom: total.addedAtBottom + d.addedAtBottom,
                                };
                                cursor = gap.logs[gap.logs.length - 1]!.id;
                                if (cursor >= msg.lastLogId) break;
                            }
                            if (total.addedAtTop + total.addedAtBottom > 0) commit(total);
                        }
                        phase.current = "live";
                        setConnection("live");
                        return;
                    }

                    // First connection: history is requested only now, with anything
                    // that arrived in the meantime already captured in the buffer.
                    setConnection("reconciling");
                    try {
                        // The bulk build asks for everything in one request. It
                        // still pages after that: the cursor comes from the
                        // oldest row held, so `loadOlder` works either way.
                        const history = bulk
                            ? await fetchLogsBulk(bulk).then((d) => ({ logs: d.logs, hasMore: d.truncated }))
                            : await fetchHistory({ before: msg.lastLogId + 1, limit: pageSize, projection });
                        const a = insert(history.logs);
                        const b = insert(preHistoryBuffer.current);
                        preHistoryBuffer.current = [];
                        hasMoreRef.current = history.hasMore;
                        setHasMore(history.hasMore);
                        phase.current = "live";
                        commit({
                            addedAtTop: a.addedAtTop + b.addedAtTop,
                            addedAtBottom: a.addedAtBottom + b.addedAtBottom,
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

    return { traces, connection, hasMore, loadingOlder, bootId, commits, liveCount, delta, loadOlder };
}
