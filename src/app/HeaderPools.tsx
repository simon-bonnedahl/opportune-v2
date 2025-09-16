"use client";

import Link from "next/link";

export default function HeaderPools() {
  return (
    <div className="sticky top-0 z-40 border-b border-[var(--border)] bg-neutral-950/70 backdrop-blur">
      <div className="max-w-5xl mx-auto px-4 py-2 flex items-center justify-between text-sm">
        <div className="font-semibold">Workpools</div>
        <div className="flex items-center gap-6">
          <PoolItem label="Import" />
          <PoolItem label="Build" />
          <PoolItem label="Embed" />
          <PoolItem label="Match" />
          <Link href="/playground" className="text-neutral-300 hover:text-white underline underline-offset-4">Playground</Link>
          <Link href="/tasks" className="text-neutral-300 hover:text-white underline underline-offset-4">Tasks</Link>
          <Link href="/import" className="text-neutral-300 hover:text-white underline underline-offset-4">Import</Link>
          <Link href="/candidates" className="text-neutral-300 hover:text-white underline underline-offset-4">Candidates</Link>
          <Link href="/jobs" className="text-neutral-300 hover:text-white underline underline-offset-4">Jobs</Link>
        </div>
      </div>
    </div>
  );
}

function PoolItem({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-neutral-400">{label}</span>
    </div>
  );
}


