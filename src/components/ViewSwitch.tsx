"use client";

import Link from "next/link";

export function ViewSwitch({ active }: { active: "naive" | "optimized" }) {
    const tab = (href: string, label: string, key: string, hint: string) => (
        <Link
            href={href}
            className={`flex flex-col px-4 py-2 text-sm transition ${
                active === key ? "bg-white/10 text-white" : "text-white/45 hover:bg-white/5 hover:text-white/75"
            }`}
        >
            <span>{label}</span>
            <span className="text-[10px] text-white/35">{hint}</span>
        </Link>
    );
    return (
        <nav className="flex items-center border-b border-white/10 bg-[#0d1117]">
            <span className="px-4 text-xs font-medium tracking-wide text-white/70">neatlog viewer</span>
            <div className="flex">
                {tab("/optimized", "Optimised", "optimized", "virtualised · list projection · batched")}
                {tab("/naive", "Unoptimised", "naive", "full DOM · full documents · unbatched")}
            </div>
        </nav>
    );
}
