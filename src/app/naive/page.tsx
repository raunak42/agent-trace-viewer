"use client";

import { TraceListView } from "@/components/nl/TraceListView";

export default function NaiveList() {
    return <TraceListView virtualise={false} view="naive" />;
}
