import type { HistoryResponse, Trace } from "./types";

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "https://onnboard.com";
export const WS_URL = `${API_BASE.replace(/^http/, "ws")}/api/stream`;

/** Bytes transferred, so the two views can be compared honestly. */
export interface FetchStats {
    bytes: number;
    requests: number;
}

export const stats: Record<"naive" | "optimized", FetchStats> = {
    naive: { bytes: 0, requests: 0 },
    optimized: { bytes: 0, requests: 0 },
};

export function resetStats(view: "naive" | "optimized"): void {
    stats[view] = { bytes: 0, requests: 0 };
}

async function measured<T>(view: "naive" | "optimized" | null, url: string): Promise<T> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
    const text = await res.text();
    if (view) {
        stats[view].bytes += new Blob([text]).size;
        stats[view].requests += 1;
    }
    return JSON.parse(text) as T;
}

export function fetchHistory(options: {
    before?: number;
    after?: number;
    limit?: number;
    projection?: "session" | "list";
    view?: "naive" | "optimized";
}): Promise<HistoryResponse> {
    const q = new URLSearchParams();
    if (options.before !== undefined) q.set("before", String(options.before));
    if (options.after !== undefined) q.set("after", String(options.after));
    q.set("limit", String(options.limit ?? 50));
    if (options.projection) q.set("projection", options.projection);
    return measured(options.view ?? null, `${API_BASE}/api/logs?${q}`);
}

/** Full trace with spans — fetched only when a row is expanded. */
export function fetchTrace(traceId: string, view?: "naive" | "optimized"): Promise<Trace> {
    return measured(view ?? null, `${API_BASE}/api/traces/${traceId}`);
}

/**
 * Their detail route opens the whole session a trace belongs to, not the trace
 * alone. Our backend has no sessionId filter, but turns land as one contiguous
 * run of ids, so a window around the anchor covers the session; the window is
 * deliberately wider than the longest run we generate.
 */
export async function fetchSession(traceId: string, view?: "naive" | "optimized"): Promise<{
    anchor: Trace;
    turns: Trace[];
}> {
    const anchor = await fetchTrace(traceId, view);
    const window = await fetchHistory({
        before: anchor.id + 16, limit: 32, projection: "list", view,
    });
    const inSession = window.logs
        .filter((l) => l.sessionId === anchor.sessionId)
        .sort((a, b) => a.id - b.id);

    const turns = await Promise.all(
        inSession.map((l) => (l._id === anchor._id ? Promise.resolve(anchor) : fetchTrace(l._id, view))),
    );
    return { anchor, turns: turns.length > 0 ? turns : [anchor] };
}
