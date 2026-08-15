/**
 * The builds the demo compares, and what separates them.
 *
 * Three independent choices, not one axis. A client can ask for the whole
 * thing or a page of it; it can ask once or once per row; and it can mount
 * everything it holds or only what is on screen. They are different decisions
 * with different costs, and collapsing them into a single "optimised" flag
 * makes it impossible to say which one bought what.
 *
 *   fanout    an index, then one request per row, everything mounted
 *   bulk      one request, everything mounted
 *   paged     a page at a time, everything mounted
 *   windowed  a page at a time, only what is near the viewport mounted
 *
 * fanout against bulk isolates the request count — same rows, same rendering.
 * bulk against paged isolates how much is asked for. paged against windowed
 * isolates how much is mounted.
 */
export type Build = "fanout" | "bulk" | "paged" | "windowed";

interface BuildInfo { id: Build; label: string; note: string }

const FANOUT: BuildInfo = { id: "fanout", label: "Fan-out fetch", note: "one request per turn · everything mounted" };
const BULK: BuildInfo = { id: "bulk", label: "Bulk fetch", note: "one request · everything mounted" };
const PAGED: BuildInfo = { id: "paged", label: "Paged API", note: "cursor pages · everything mounted" };
const WINDOWED: BuildInfo = { id: "windowed", label: "Paged + virtualised", note: "cursor pages · viewport only" };

/**
 * The list has no fan-out build, because the page it mirrors has no fan-out.
 * app.neatlogs.com asks for its rows in one query of 25 and renders them from
 * that; it is the transcript that fetches per turn. Offering the build here
 * anyway would invent a problem they do not have.
 */
export const BUILDS: BuildInfo[] = [BULK, PAGED, WINDOWED];
export const SESSION_BUILDS: BuildInfo[] = [FANOUT, BULK, PAGED, WINDOWED];

export const isBuild = (v: string | null): v is Build =>
    v === "fanout" || v === "bulk" || v === "paged" || v === "windowed";

/** Takes the whole thing in one request. */
export const bulkFetches = (b: Build) => b === "bulk" || b === "fanout";
/** Follows the index with a request per row. */
export const fansOut = (b: Build) => b === "fanout";
/** Mounts only what is near the viewport. */
export const virtualises = (b: Build) => b === "windowed";

/** How many items the single-request builds ask for. */
export const BULK_LIMIT = 15_000;
/**
 * How many turns the fan-out build will chase. Lower than the bulk limit on
 * purpose: this is the one build whose cost lands on the server as well as the
 * browser, and 15,000 round trips is a load test of our own API rather than a
 * demonstration of theirs.
 */
export const FANOUT_LIMIT = 2_000;
