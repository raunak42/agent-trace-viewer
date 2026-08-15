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
