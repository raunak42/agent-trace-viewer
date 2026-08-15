import type { HistoryResponse, SessionPage, SessionSummary, Trace, TraceSummary } from "./types";

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "https://onnboard.com";
export const WS_URL = `${API_BASE.replace(/^http/, "ws")}/api/stream`;

async function get<T>(url: string): Promise<T> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
    return (await res.json()) as T;
}

export function fetchHistory(options: {
    before?: number;
    after?: number;
    limit?: number;
    projection?: "session" | "list";
}): Promise<HistoryResponse> {
    const q = new URLSearchParams();
    if (options.before !== undefined) q.set("before", String(options.before));
    if (options.after !== undefined) q.set("after", String(options.after));
    q.set("limit", String(options.limit ?? 50));
    if (options.projection) q.set("projection", options.projection);
    return get(`${API_BASE}/api/logs?${q}`);
}

/** Full trace with spans — fetched only when a row is expanded. */
export function fetchTrace(traceId: string): Promise<Trace> {
    return get(`${API_BASE}/api/traces/${traceId}`);
}

/** Sessions ranked by turn count — how the demo finds one worth opening. */
export function fetchSessionList(limit = 20):
Promise<{ sessions: SessionSummary[]; total: number }> {
    return get(`${API_BASE}/api/sessions?limit=${limit}`);
}

/**
 * One page of a session's turns. Turn ids interleave with every other session
 * in the stream, so a session can only be read through this endpoint — the
 * window-around-the-anchor trick this used to do cannot work any more.
 */
export function fetchSessionPage(sessionId: string, options: {
    after?: number;
    before?: number;
    limit?: number;
    projection?: "session" | "list";
} = {}): Promise<SessionPage> {
    const q = new URLSearchParams();
    if (options.after !== undefined) q.set("after", String(options.after));
    if (options.before !== undefined) q.set("before", String(options.before));
    q.set("limit", String(options.limit ?? 50));
    if (options.projection) q.set("projection", options.projection);
    return get(`${API_BASE}/api/sessions/${sessionId}?${q}`);
}

export interface BufferStats {
    bootId: string;
    size: number;
    oldestId: number;
    lastLogId: number;
    sessions: number;
}

/** How much history exists server-side, read once so the header can say what
 *  was already there before this page started watching. */
export function fetchStats(): Promise<BufferStats> {
    return get(`${API_BASE}/api/stats`);
}

/** Everything at once, no cursor — what the unoptimised build calls. */
export function fetchSessionBulk(sessionId: string, limit: number):
Promise<{ logs: TraceSummary[]; total: number; truncated: boolean }> {
    return get(`${API_BASE}/api/sessions/${sessionId}/bulk?limit=${limit}&projection=list`);
}

export function fetchLogsBulk(limit: number):
Promise<{ logs: TraceSummary[]; total: number; truncated: boolean }> {
    return get(`${API_BASE}/api/logs/bulk?limit=${limit}&projection=list`);
}
