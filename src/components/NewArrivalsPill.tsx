"use client";

export function NewArrivalsPill({ count, onClick }: { count: number; onClick: () => void }) {
    if (count <= 0) return null;
    return (
        <button
            onClick={onClick}
            className="absolute bottom-5 left-1/2 z-10 -translate-x-1/2 rounded-full bg-violet-600 px-4 py-1.5 text-xs font-medium text-white shadow-lg shadow-violet-900/40 transition hover:bg-violet-500"
        >
            ↓ {count} new
        </button>
    );
}
