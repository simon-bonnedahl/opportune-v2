"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export default function HeaderPools() {
  const overview = useQuery(api.tasks.getWorkpoolOverview as any);


  return (
    <div className="sticky top-0 z-40 border-b border-[var(--border)] bg-neutral-950/70 backdrop-blur">
      <div className="max-w-5xl mx-auto px-4 py-2 flex items-center justify-between text-sm">
        <div className="font-semibold">Workpools</div>
        <div className="flex items-center gap-6">
          <PoolItem label="Import" counts={overview?.import} />
          <PoolItem label="Build" counts={overview?.build} />
          <PoolItem label="Embed" counts={overview?.embed} />
          <PoolItem label="Match" counts={overview?.match} />
          <Link href="/playground" className="text-neutral-300 hover:text-white underline underline-offset-4">Playground</Link>
          <Link href="/workpools" className="text-neutral-300 hover:text-white underline underline-offset-4">Workpools</Link>
          <Link href="/import" className="text-neutral-300 hover:text-white underline underline-offset-4">Import</Link>
          <Link href="/candidates" className="text-neutral-300 hover:text-white underline underline-offset-4">Candidates</Link>
          <Link href="/jobs" className="text-neutral-300 hover:text-white underline underline-offset-4">Jobs</Link>
        </div>
      </div>
    </div>
  );
}

function PoolItem({ label, counts }: { label: string; counts?: { pending: number; running: number; finished: number } }) {
  const p = counts?.pending ?? 0;
  const r = counts?.running ?? 0;
  const f = counts?.finished ?? 0;
  const pill = (n: number, color: string, title: string) => (
    <span title={title} className={`px-2 py-0.5 rounded-full text-xs ${color} border border-[var(--border)] bg-neutral-900`}>{n}</span>
  );
  return (
    <div className="flex items-center gap-2">
      <span className="muted">{label}</span>
      <div className="flex items-center gap-1">
        {pill(p, "text-yellow-400", "Pending")}
        {pill(r, "text-blue-400", "Running")}
        {pill(f, "text-green-400", "Finished")}
      </div>
    </div>
  );
}


