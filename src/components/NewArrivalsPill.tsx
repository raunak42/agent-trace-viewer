"use client";

import { ChevronUpIcon } from "./nl/icons";

export function NewArrivalsPill({ count, onClick }: { count: number; onClick: () => void }) {
    if (count <= 0) return null;
    return (
        <button
            onClick={onClick}
            className="absolute top-3 left-1/2 z-10 flex -translate-x-1/2 cursor-pointer items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-foreground shadow-md transition-colors hover:bg-primary/90"
        >
            <ChevronUpIcon className="size-3.5" />
            {count.toLocaleString()} new
        </button>
    );
}
