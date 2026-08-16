/**
 * The three builds the demo compares, and what separates them.
 *
 * Two independent choices, not one axis. A client can ask for the whole thing
 * or a page of it, and it can mount everything it holds or only what is on
 * screen. They are different decisions with different costs, and collapsing
 * them into a single "optimised" flag makes it impossible to say which one
 * bought what.
 *
 *   bulk      one request, everything mounted
 *   paged     a page at a time, everything mounted
 *   windowed  a page at a time, only what is near the viewport mounted
 *
 * bulk against paged isolates how much is asked for; paged against windowed
 * isolates how much is mounted. Three is also the most a reader can hold at
 * once — a fourth turns the switch into something to study rather than read.
 */
export type Build = "bulk" | "paged" | "windowed";

export const BUILDS: Array<{ id: Build; label: string; note: string }> = [
    { id: "bulk", label: "Bulk fetch", note: "one request · everything mounted" },
    { id: "paged", label: "Paged API", note: "cursor pages · everything mounted" },
    { id: "windowed", label: "Paged + virtualised", note: "cursor pages · viewport only" },
];

export const isBuild = (v: string | null): v is Build =>
    v === "bulk" || v === "paged" || v === "windowed";

/** Takes the whole thing in one request. */
export const bulkFetches = (b: Build) => b === "bulk";
/** Mounts only what is near the viewport. */
export const virtualises = (b: Build) => b === "windowed";

/**
 * How many rows the list's single-request build asks for. 15,000 already puts
 * ~470,000 nodes in the document and blocks the main thread for over a second,
 * which is the point being made; more only risks the tab dying instead of
 * struggling, and a dead tab demonstrates nothing.
 */
export const BULK_LIMIT = 15_000;
/**
 * The transcript asks for more. A turn is worth roughly a third of a row in
 * nodes — it renders as two blocks and a header rather than a full table row —
 * so the same count lands much lighter here, and 15,000 turns was not enough
 * to make the page feel it.
 */
export const SESSION_BULK_LIMIT = 25_000;
