/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";

type Tab = "candidates" | "jobs";

export default function ImportPage() {
  const [tab, setTab] = useState<Tab>("candidates");
  const enqueueCandidates = useMutation(api.teamtailor.enqueueCandidateImports as any);
  const enqueueJobs = useMutation(api.teamtailor.enqueueJobImports as any);
  const [candidateIds, setCandidateIds] = useState("");
  const [jobIds, setJobIds] = useState("");
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-xl font-semibold mb-4">Import</h1>
      <div className="flex items-center gap-2 mb-4">
        <button className={`px-2 py-1 rounded border border-[var(--border)] ${tab === "candidates" ? "bg-neutral-800" : "bg-neutral-900"}`} onClick={() => setTab("candidates")}>Candidates</button>
        <button className={`px-2 py-1 rounded border border-[var(--border)] ${tab === "jobs" ? "bg-neutral-800" : "bg-neutral-900"}`} onClick={() => setTab("jobs")}>Jobs</button>
      </div>
      {tab === "candidates" ? (
        <div className="space-y-2">
          <label className="text-sm">Teamtailor Candidate IDs (comma-separated)</label>
          <textarea value={candidateIds} onChange={(e) => setCandidateIds(e.target.value)} className="w-full h-32 rounded bg-neutral-900 border border-[var(--border)] p-2 text-sm" placeholder="123,456,789" />
          <button
            onClick={() => {
              const ids = candidateIds.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
              if (ids.length > 0) enqueueCandidates({ candidateIds: ids } as any);
            }}
            className="px-3 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white text-sm"
          >
            Enqueue Candidate Imports
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <label className="text-sm">Teamtailor Job IDs (comma-separated)</label>
          <textarea value={jobIds} onChange={(e) => setJobIds(e.target.value)} className="w-full h-32 rounded bg-neutral-900 border border-[var(--border)] p-2 text-sm" placeholder="job_abc, job_def" />
          <button
            onClick={() => {
              const ids = jobIds.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
              if (ids.length > 0) enqueueJobs({ jobIds: ids } as any);
            }}
            className="px-3 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white text-sm"
          >
            Enqueue Job Imports
          </button>
        </div>
      )}
    </div>
  );
}



