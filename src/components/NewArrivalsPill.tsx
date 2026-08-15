"use client";

import { ChevronDownIcon, ChevronUpIcon } from "./nl/icons";

export function NewArrivalsPill({ count, onClick, direction = "up" }: {
    count: number;
    onClick: () => void;
    /** Which way the unseen rows are: the list grows upward, a transcript downward. */
    direction?: "up" | "down";
}) {
    if (count <= 0) return null;
    return (
        <button
            onClick={onClick}
            className={`absolute left-1/2 z-10 flex -translate-x-1/2 ${direction === "up" ? "top-3" : "bottom-4"} cursor-pointer items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-foreground shadow-md transition-colors hover:bg-primary/90`}
        >
            {direction === "up" ? <ChevronUpIcon className="size-3.5" /> : <ChevronDownIcon className="size-3.5" />}
            {count.toLocaleString()} new
        </button>
    );
}
