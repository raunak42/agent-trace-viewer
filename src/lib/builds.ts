/**
 * The three builds the demo compares, and what separates them.
 *
 * Two independent choices, not one axis. A client can ask the server for only
 * what it can show, and it can mount only what is on screen; they are different
 * decisions with different costs, and collapsing them into a single
 * "optimised" flag makes it impossible to say which one bought what.
 *
 *   bulk     everything in one request, everything mounted
 *   paged    a page at a time, everything mounted
 *   windowed a page at a time, only what is near the viewport mounted
 *
 * `bulk` and `paged` differ only in fetching; `paged` and `windowed` differ
 * only in rendering.
 */
export type Build = "bulk" | "paged" | "windowed";

export const BUILDS: Array<{ id: Build; label: string; note: string }> = [
    { id: "bulk", label: "Unoptimised", note: "one request · everything mounted" },
    { id: "paged", label: "Paged API", note: "cursor pages · everything mounted" },
    { id: "windowed", label: "Paged + virtualised", note: "cursor pages · viewport only" },
];

export const isBuild = (v: string | null): v is Build =>
    v === "bulk" || v === "paged" || v === "windowed";

/** Fetches everything up front. */
export const bulkFetches = (b: Build) => b === "bulk";
/** Mounts only what is near the viewport. */
export const virtualises = (b: Build) => b === "windowed";

/** How many items the bulk build asks for in its single request. */
export const BULK_LIMIT = 15_000;
