"use client";

import Link from "next/link";
import { type Build, BUILDS } from "@/lib/builds";
import {
    TracesIcon, SearchIcon, CalendarIcon, CloseIcon, ChevronDownIcon,
    FunnelIcon, PlusIcon, SlidersIcon,
} from "./icons";

/* ── top bar ──────────────────────────────────────────────────────────────
   Title left, search / date-range / display-preferences right. Their date
   pill is a bordered group: calendar icon, label, clear, chevron.          */
export function TopBar({ range }: { range: string }) {
    return (
        <div className="flex h-[68px] shrink-0 items-center justify-between px-6">
            <div className="flex min-w-0 items-center gap-2">
                <TracesIcon className="size-4 shrink-0 text-foreground" />
                <h1 className="text-base leading-5 font-normal text-foreground">Traces</h1>
            </div>
            <div className="flex shrink-0 items-center gap-2">
                <button type="button" aria-label="Search"
                    className="flex size-9 cursor-pointer items-center justify-center rounded-lg border border-border text-foreground transition-colors hover:bg-muted">
                    <SearchIcon />
                </button>
                <div className="flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-[13px] text-foreground">
                    <CalendarIcon className="size-4 shrink-0 text-foreground" />
                    <span className="whitespace-nowrap">{range}</span>
                    <button type="button" aria-label="Clear range" className="cursor-pointer text-muted-foreground hover:text-foreground">
                        <CloseIcon className="size-4" />
                    </button>
                    <ChevronDownIcon className="size-4 shrink-0 text-foreground" />
                </div>
                <button type="button" aria-label="Display preferences"
                    className="flex size-9 cursor-pointer items-center justify-center rounded-lg border border-border text-foreground transition-colors hover:bg-muted">
                    <SlidersIcon />
                </button>
            </div>
        </div>
    );
}

/* ── filter chips ─────────────────────────────────────────────────────────
   26px tall, fully rounded, 12px medium label with a chevron. "Advanced" is
   the dashed one that adds a new condition.                                */
const Chip = ({ label, dashed = false, icon }: { label: string; dashed?: boolean; icon?: React.ReactNode }) => (
    <button
        type="button"
        aria-label={`${label} filter`}
        className={`inline-flex h-[26px] shrink-0 cursor-pointer items-center gap-1 rounded-full bg-background pr-1.5 pl-2.5 text-xs whitespace-nowrap text-foreground transition-colors hover:bg-muted ${
            dashed ? "border border-dashed border-border" : "border border-border"
        }`}
    >
        {icon}
        <span className="font-medium">{label}</span>
        {!icon && <ChevronDownIcon className="size-3.5 shrink-0 text-muted-foreground" />}
    </button>
);

export function FilterBar() {
    return (
        <div className="flex shrink-0 items-center gap-2 overflow-x-auto px-6 pb-3">
            <FunnelIcon className="size-3.5 shrink-0 text-muted-foreground" />
            <Chip label="Session ID" />
            <Chip label="Workflow" />
            <Chip label="Status" />
            <Chip label="Latency" />
            <Chip label="Tokens" />
            <Chip label="More filters" />
            <Chip label="Advanced" dashed icon={<PlusIcon className="size-3.5 shrink-0" />} />
        </div>
    );
}

/* ── volume histogram ─────────────────────────────────────────────────────
   Buckets whatever is loaded by time. Empty buckets still draw their cell so
   the grid reads as a continuous axis, which is how theirs behaves.         */
export function Histogram({ buckets, labels }: { buckets: number[]; labels: string[] }) {
    const peak = Math.max(1, ...buckets);
    return (
        <div className="shrink-0 border-t border-border px-6 pt-3 pb-1">
            <div className="flex h-[72px] items-end gap-px">
                {buckets.map((v, i) => (
                    <div key={i} className="flex h-full flex-1 items-end border-r border-chart-grid last:border-r-0">
                        <div
                            className="w-full rounded-t-[2px] bg-chart-1/22 transition-[height] duration-300"
                            // Headroom so a uniformly busy window still reads as bars
                            // rather than one filled block.
                            style={{ height: `${v === 0 ? 0 : Math.max(5, (v / peak) * 85)}%` }}
                            title={`${v} traces`}
                        />
                    </div>
                ))}
            </div>
            <div className="mt-1.5 flex justify-between font-mono text-2xs text-muted-foreground/70">
                {labels.map((l, i) => <span key={i}>{l}</span>)}
            </div>
        </div>
    );
}

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
