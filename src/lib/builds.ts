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
 * so the same row count lands much lighter here, and 15,000 turns was not
 * enough to make the page feel it.
 */
export const SESSION_BULK_LIMIT = 25_000;
/**
 * How many turns the fan-out build will chase — the size Neatlogs named as
 * where their transcript starts to struggle, so the comparison is against the
 * case they actually reported. Far below the bulk limit on purpose: this is the
 * one build whose cost lands on the server as well as the browser, and 25,000
 * round trips is a load test of our own API rather than a demonstration of
 * theirs.
 */
export const FANOUT_LIMIT = 2_500;
