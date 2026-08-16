"use client";

import { COLUMNS, ROW_HEIGHT, cellStyle } from "./TraceTable";

/**
 * Placeholders shaped like the thing that is coming.
 *
 * These pages can wait a long time on purpose. The bulk build asks for 25,000
 * turns in one request — 19 MB, a second and a half on the wire before a single
 * row exists — and the fan-out build spends minutes on thousands of round
 * trips. An empty pane for that long reads as broken rather than busy, and the
 * point of the demo is that the cost is visible, not that the page looks dead.
 *
 * Laid out from the same geometry as the real rows, so nothing shifts when the
 * data lands.
 */

/** Deterministic, because a width chosen with Math.random() would differ
 *  between the server render and the client one and count as a mismatch. */
const WIDTHS = [82, 61, 94, 47, 73, 88, 55, 68];
const widthAt = (seed: number, span = 40) => `${span + (WIDTHS[seed % WIDTHS.length]! % (100 - span))}%`;

function Bar({ w, h = 8 }: { w: string | number; h?: number }) {
    return <span className="block rounded-sm bg-foreground/10" style={{ width: w, height: h }} />;
}

/** Rows for the trace table, matching its columns cell for cell. */
export function TraceRowsSkeleton({ rows = 16 }: { rows?: number }) {
    return (
        <div className="animate-pulse" aria-hidden>
            {Array.from({ length: rows }, (_, r) => (
                <div key={r} className="flex w-full items-center border-b border-border-soft"
                    style={{ height: ROW_HEIGHT }}>
                    {COLUMNS.map((c, i) => (
                        <div key={c.id} style={cellStyle(c)} className="flex h-full min-w-0 items-center">
                            <Bar w={widthAt(r * COLUMNS.length + i, c.grow ? 55 : 40)} />
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
}

/** Rows for the conversations view. Its columns are its own, so they come in
 *  from the caller rather than being duplicated here. */
export function SessionRowsSkeleton({ rows = 12, columns, style }: {
    rows?: number;
    columns: ReadonlyArray<{ id: string }>;
    style: (c: never) => React.CSSProperties;
}) {
    return (
        <div className="animate-pulse" aria-hidden>
            {Array.from({ length: rows }, (_, r) => (
                <div key={r} className="flex w-full items-center border-b border-border-soft" style={{ height: 44 }}>
                    {columns.map((c, i) => (
                        <div key={c.id} style={style(c as never)} className="flex h-full min-w-0 items-center">
                            <Bar w={widthAt(r * columns.length + i)} />
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
}

/** Turns for the transcript: an input bubble on the right, a step bar, output. */
export function TurnsSkeleton({ turns = 4 }: { turns?: number }) {
    return (
        <div className="animate-pulse" aria-hidden>
            {Array.from({ length: turns }, (_, t) => (
                <section key={t} className={t > 0 ? "border-t border-border pt-8" : ""}>
                    <div className="mb-3 flex flex-col items-end gap-1.5">
                        <Bar w={34} h={7} />
                        <div className="max-w-[70%] rounded-xl border border-border px-4 py-3.5">
                            <Bar w={widthAt(t * 3, 55)} />
                        </div>
                    </div>
                    <div className="rounded-xl border border-border">
                        <div className="flex items-center gap-2 px-3.5 py-3.5">
                            <Bar w={14} h={14} />
                            <Bar w={96} />
                            <Bar w={150} />
                        </div>
                    </div>
                    <div className="mt-5 mb-8 flex flex-col gap-2">
                        <Bar w={44} h={7} />
                        <Bar w={widthAt(t * 3 + 1, 60)} h={10} />
                        <Bar w={widthAt(t * 3 + 2, 35)} h={10} />
                    </div>
                </section>
            ))}
        </div>
    );
}

/** The step tree of a turn being opened, indented the way spans are. */
export function StepsSkeleton({ steps = 3 }: { steps?: number }) {
    return (
        <div className="animate-pulse py-1.5" aria-hidden>
            {Array.from({ length: steps }, (_, i) => (
                <div key={i} className="flex items-center gap-2 py-1.5" style={{ paddingLeft: (i % 3) * 16 }}>
                    <Bar w={12} h={12} />
                    <Bar w={widthAt(i, 30)} />
                </div>
            ))}
        </div>
    );
}
