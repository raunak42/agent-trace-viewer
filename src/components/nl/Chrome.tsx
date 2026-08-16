"use client";

import Link from "next/link";
import { type Build, BUILDS } from "@/lib/builds";

/* ── build switch ─────────────────────────────────────────
   Not part of their UI — this demo has three builds to compare. Each pair
   differs in exactly one thing, so the labels name that thing.             */
export function BuildSwitch({ active }: { active: Build }) {
    return (
        <div className="flex h-12 shrink-0 items-center gap-1 border-b border-border px-4">
            {BUILDS.map((b) => (
                <Link key={b.id} href={`/${b.id}`}
                    className={`flex flex-col justify-center border-b-2 px-4 py-2 transition-colors ${
                        active === b.id
                            ? "border-primary text-foreground"
                            : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}>
                    <span className="text-[13px] leading-4 font-medium">{b.label}</span>
                    <span className="text-2xs text-muted-foreground/70">{b.note}</span>
                </Link>
            ))}
        </div>
    );
}
