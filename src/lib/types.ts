/** Mirrors the neatlog-stream API. Kept in sync by hand; the backend is not modified. */

export type NodeType = "agent_action" | "chain" | "tool_call" | "retrieval";
export type TraceStatus = "success" | "error";

export interface SpanData {
    input_value: string;
    output_value: string;
    display_blocks?: Array<{ type: "input" | "output"; label: string; content: string }>;
    duration_ms: number;
    llm_model: string;
    provider: string;
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    tool_name: string;
    tool_description: string;
    error_message: string;
    error_type: string;
    agent_name: string;
}

export interface Span {
    span_id: string;
    parent_span_id?: string;
    traceId: string;
    node_type: NodeType;
    node_name: string;
    status: "SUCCESS" | "ERROR";
    data: SpanData;
    span_metadata: Record<string, string> | null;
    output_truncated?: boolean;
    payload_signed_url?: string;
}

/** Fields present under `projection=list` — no `spans`. */
export interface TraceSummary {
    id: number;
    ts: number;
    _id: string;
    name: string;
    createdAt: string;
    latency: number;
    spanCount: number;
    llmCalls: number;
    toolCalls: number;
    hasError: 0 | 1;
    errorCount: number;
    promptTokens: number;
    completionTokens: number;
    totalTokensUsed: number;
    totalTokensCost: number;
    workflowName: string;
    sessionId: string;
    /** Denormalised from the root span, so a list row needs no spans. */
    input: string;
    output: string;
    status: TraceStatus;
    projection: "session" | "list";
}

/** Full document — what `projection=session` and the detail endpoint return. */
export interface Trace extends TraceSummary {
    spans: Span[];
}

export interface HistoryResponse {
    logs: TraceSummary[];
    nextCursor: number | null;
    hasMore: boolean;
}

export type ServerMessage =
    | { type: "connected"; lastLogId: number; bootId: string }
    | { type: "log"; data: Trace };

/** One page of a session's turns. */
export interface SessionPage {
    logs: TraceSummary[];
    total: number;
    nextCursor: number | null;
    hasMore: boolean;
}

export interface SessionSummary {
    sessionId: string;
    turns: number;
    lastId: number;
}
