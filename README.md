# agent-trace-viewer

A viewer for agent traces — scrollable history plus a live tail over a stream
that never stops arriving, built three times so the cost of each shortcut is
visible rather than argued about.

| build | fetches | renders |
| --- | --- | --- |
| Bulk fetch | everything in one request | every row mounted |
| Paged API | cursor pages | every row mounted |
| Paged + virtualised | cursor pages | only rows near the viewport |

Two independent choices, one variable at a time: bulk against paged isolates
how much is asked for, paged against virtualised isolates how much is mounted.
The backend holds ~100,000 traces in a ring buffer and adds five a second, and
one conversation runs indefinitely, so the transcript is always long and always
growing.

```bash
npm install
npm run dev     # http://localhost:3000
```

Points at `https://onnboard.com` by default; override with `NEXT_PUBLIC_API_BASE`.

| Route | |
|---|---|
| `/optimized` | virtualised · `projection=list` · batched updates |
| `/naive` | every row mounted · full documents · a commit per message |

Both views share **identical reconciliation logic**. Correctness is not the
variable being demonstrated — rendering and payload are.

## Reconciliation (Approach A)

The ordering matters, and it is the same in both views:

1. Open the WebSocket **first**
2. On the `connected` handshake, record `lastLogId`
3. Buffer every `log` message that arrives from here on — render nothing yet
4. *Then* fetch `GET /api/logs?before=<lastLogId + 1>&limit=50`
5. Merge history with the buffer, dedupe by `id`, sort — that is the initial store
6. Switch to live mode: subsequent messages append directly

REST-first would leave a window between the history response and the socket
opening in which entries are silently lost. This ordering cannot lose one; the
worst case is a duplicate, which dedupe-by-id removes.

**On reconnect** the handshake's `lastLogId` is compared against the newest id
held locally, and only the gap is backfilled via `?after=`, rather than
reloading everything.

**On a changed `bootId`** the store is cleared entirely. A different boot id
means the server restarted or this is a different replica, so local ids no
longer refer to the same entries — cursors are meaningless and merging would
corrupt the view.

## What `/optimized` does differently

**Virtualised list** — `@tanstack/react-virtual` mounts roughly 30–50 rows plus
overscan. Rows outside the window are genuinely unmounted, not hidden with CSS.

**`projection=list`** — the list needs id, name, latency, status and token
counts. Spans are ~90% of a trace document and are never fetched for a row:
**0.6 KB per row instead of 5.2 KB**. Full spans load on demand from
`GET /api/traces/:traceId` when a row is opened.

**Batched live updates** — messages arriving in a burst are collected for 150 ms
and flushed once, so N messages cost one React commit rather than N.

**Sentinel-based stick-to-bottom** — an `IntersectionObserver` on a bottom
sentinel answers "am I at the bottom", instead of reading `scrollTop` on every
scroll event. Auto-scroll applies only when the user is already at the bottom;
otherwise a **↓ N new** pill appears and the view stays put.

**rAF-throttled pagination** — scrolling near the top triggers
`?before=<oldest loaded id>`, throttled so a fast scroll cannot queue dozens of
overlapping fetches. Stops at `hasMore: false`.

## Measuring it

Both views render the same metrics bar: rows in the store, rows in the DOM, DOM
node count, React commits, and bytes fetched. `/naive` also shows a live FPS
counter. Scroll up through a few thousand entries on each and compare.
