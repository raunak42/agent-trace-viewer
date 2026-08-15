"use client";

import { useEffect, useRef, useState } from "react";
import { WS_URL } from "./api";
import type { TraceSummary } from "./types";

export interface TailStats {
    /** Frames that belonged to this session and were used. */
    kept: number;
    /** Frames delivered for other sessions and thrown away. */
    discarded: number;
    bytes: number;
}

/**
 * Live tail for one session, in the two shapes a client can ask for.
 *
 * `filtered` negotiates the subscription at connection time — the server sends
 * only this session's turns, as summaries. Otherwise the socket carries every
 * session's full documents and the client discards what it does not want,
 * which is what the naive build is meant to show.
 */
export function useSessionTail(options: {
    sessionId: string | null;
    filtered: boolean;
    onTurn: (turn: TraceSummary) => void;
}): TailStats {
    const { sessionId, filtered } = options;
    const [stats, setStats] = useState<TailStats>({ kept: 0, discarded: 0, bytes: 0 });

    // Held in a ref so a changing callback never tears the socket down. Synced
    // in an effect rather than during render, which is not allowed for refs.
    const onTurn = useRef(options.onTurn);
    useEffect(() => { onTurn.current = options.onTurn; });

    useEffect(() => {
        if (!sessionId) return;
        let closedByUs = false;
        let retry: ReturnType<typeof setTimeout> | null = null;
        let socket: WebSocket | null = null;
        let lastFrame = Date.now();
        const tally = { kept: 0, discarded: 0, bytes: 0 };

        const connect = () => {
            const url = filtered
                ? `${WS_URL}?sessionId=${encodeURIComponent(sessionId)}&projection=list`
                : WS_URL;
            const ws = new WebSocket(url);
            socket = ws;

            ws.onmessage = (event) => {
                const raw = event.data as string;
                lastFrame = Date.now();
                const msg = JSON.parse(raw);
                // Heartbeats keep the socket from idling out; they are not data,
                // so they do not count toward what this subscription cost.
                if (msg.type !== "log") return;
                tally.bytes += raw.length;

                if (msg.data.sessionId === sessionId) {
                    tally.kept += 1;
                    onTurn.current(msg.data as TraceSummary);
                } else {
                    tally.discarded += 1;
                }
                setStats({ ...tally });
            };

            ws.onclose = () => {
                if (closedByUs) return;
                retry = setTimeout(connect, 1500);
            };
            ws.onerror = () => ws.close();
        };

        connect();

        // A socket dropped without a close handshake stays readyState OPEN and
        // simply never delivers, so onclose never fires and the retry above
        // never runs. Silence past two heartbeat intervals means it is gone.
        const watchdog = setInterval(() => {
            if (Date.now() - lastFrame < 70_000) return;
            lastFrame = Date.now();
            try { socket?.close(); } catch { /* replaced below regardless */ }
            connect();
        }, 15_000);

        return () => {
            closedByUs = true;
            if (retry) clearTimeout(retry);
            clearInterval(watchdog);
            socket?.close();
        };
    }, [sessionId, filtered]);

    return stats;
}
