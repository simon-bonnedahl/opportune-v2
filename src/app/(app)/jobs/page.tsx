"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate } from "@/lib/format";

export default function JobsPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [queryText, setQueryText] = useState<string>("");

  const jobs = useQuery(api.teamtailor.getJobs) as any[] | undefined;
  const jobIds = useMemo(() => (jobs ?? []).map((j: any) => j._id as any), [jobs]);
  const processing = useQuery(api.teamtailor.getProcessingStatusByJobIds as any, { jobIds: (jobIds as any[]) ?? [] } as any) as any[] | undefined;

  const rows = useMemo(() => {
    const base = (jobs ?? []).slice();
    const filtered = queryText.trim().length
      ? base.filter((r: any) =>
          (r?.rawData?.attributes?.title ?? "").toLowerCase().includes(queryText.toLowerCase())
        )
      : base;
    return filtered.sort(
      (a: any, b: any) =>
        (b.updatedAt ?? b._creationTime) - (a.updatedAt ?? a._creationTime)
    );
  }, [jobs, queryText]);

  const enqueueJobImport = useMutation(api.teamtailor.enqueueJobImports);
  const onAddJob = async () => {
    const id = window.prompt("Teamtailor job ID");
    if (!id) return;
    try {
      await enqueueJobImport({ jobIds: [id] } as any);
    } catch (e) {
      console.warn(e);
    }
  };

  return (
    <div className="w-full px-6 py-8">
      <div className="flex items-center justify-between mb-4">
        <div className="text-xl font-semibold">Jobs</div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search..."
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            className="h-8 w-56"
          />
          <Button variant="outline" size="sm" className="h-8">
            Date
          </Button>
          <Button variant="outline" size="sm" className="h-8">
            Tags
          </Button>
          <Button onClick={onAddJob} size="sm" className="h-8">
            + Add Job
          </Button>
        </div>
      </div>

      <div className="rounded border border-[var(--border)] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-accent/40 dark:bg-neutral-900">
            <tr>
              <th className="text-left p-2 w-[40%]">Title</th>
              <th className="text-left p-2">Tags</th>
              <th className="text-left p-2">Best Match</th>
              <th className="text-left p-2">Status</th>
              <th className="text-left p-2">Imported</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r: any) => (
              <tr
                key={r._id}
                className="border-t border-[var(--border)] hover:bg-neutral-900/50 cursor-pointer"
                onClick={() => setSelectedId(r._id)}
              >
                <td className="p-2">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="text-[11px]">
                        {getInitials(r?.rawData?.attributes?.title ?? String(r._id))}
                      </AvatarFallback>
                    </Avatar>
                    <div className="font-medium truncate">{r?.rawData?.attributes?.title ?? r._id}</div>
                  </div>
                </td>
                <td className="p-2">
                  <div className="flex flex-wrap gap-1">
                    {getJobTags(r).slice(0, 4).map((t) => (
                      <Badge key={t} variant="outline" className="px-1 py-0 text-[11px]">
                        {t}
                      </Badge>
                    ))}
                    {getJobTags(r).length > 4 && (
                      <Badge variant="secondary" className="px-1 py-0 text-[11px]">
                        +{getJobTags(r).length - 4}
                      </Badge>
                    )}
                  </div>
                </td>
                <td className="p-2"></td>
                <td className="p-2">
                  <JobStatusPill jobId={r._id} processing={processing} />
                </td>
                <td className="p-2 whitespace-nowrap">
                  {formatDate(r.updatedAt ?? r._creationTime, { month: "short" })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedId && <JobDialog id={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  );
}

function getInitials(text?: string) {
  if (!text) return "?";
  const parts = text.split(" ").filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

function getJobTags(row: any): string[] {
  const tags: string[] = [];
  const attrs = row?.rawData?.attributes ?? {};
  if (Array.isArray(attrs?.tags)) {
    for (const t of attrs.tags) if (typeof t === "string") tags.push(t);
  }
  if (typeof attrs?.status === "string") tags.push(attrs.status);
  if (typeof attrs?.location === "string") tags.push(attrs.location);
  if (typeof attrs?.["location-name"] === "string") tags.push(attrs["location-name"]);
  if (typeof attrs?.department === "string") tags.push(attrs.department);
  return tags;
}

// Best match column intentionally left blank for now

function JobStatusPill({ jobId, processing }: { jobId: string; processing: any[] | undefined }) {
  const row = (processing ?? []).find((p: any) => (p?.jobId as any) === (jobId as any));
  const processed = !!row?.processed;
  const inProc = Array.isArray(row?.inProcess) && row.inProcess.length > 0;
  const label = processed ? "Processed" : inProc ? "Processing" : "Pending";
  const color = processed ? "bg-emerald-500" : inProc ? "bg-blue-500 animate-pulse" : "bg-yellow-500";
  return (
    <div className="inline-flex items-center gap-2 text-xs">
      <span className={`inline-block h-2 w-2 rounded-full ${color}`} />
      {label}
    </div>
  );
}

function JobDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const [job] = (useQuery(api.jobs.getJobProfilesByJobIds as any, { jobIds: [id as any] } as any) as any[] | undefined) ?? [];
  const [source] = (useQuery(api.teamtailor.getJobSourceDataByJobIds as any, { jobIds: [id as any] } as any) as any[] | undefined) ?? [];
  const core = (useQuery(api.teamtailor.getJobs) as any[] | undefined)?.find((j: any) => String(j._id) === String(id));
  const matches = useQuery(api.matches.listMatchesForJob as any, { jobId: id as any, limit: 100 } as any) as any[] | undefined;
  const candidates = useQuery(api.teamtailor.getCandidates) as any[] | undefined;
  const [open, setOpen] = useState(true);
  const close = () => { setOpen(false); onClose(); };
  const title = core?.rawData?.attributes?.title ?? core?.title ?? "Job";
  const matchRows = (matches ?? []).map((m: any) => {
    const cand = (candidates ?? []).find((c: any) => String(c._id) === String(m.candidateId));
    const name = cand?.name ?? String(m.candidateId);
    const matchedAt = new Date(m.updatedAt ?? m._creationTime).toLocaleString();
    const importedAt = cand ? new Date(cand.updatedAt ?? cand._creationTime).toLocaleDateString() : "";
    return {
      id: String(m._id),
      name,
      scorePct: Math.round((Number(m.score) || 0) * 100),
      matchedAt,
      importedAt,
    };
  });
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) close(); }}>
      <DialogContent className="h-[85vh] overflow-hidden flex flex-col w-full max-w-[calc(100%-2rem)] sm:!max-w-[95vw] xl:!max-w-[1200px]">
        <DialogHeader className="border-b">
          <div className="flex items-center justify-between text-xs">
            <div />
            <DialogTitle className="text-xs font-mono">{String(id)}</DialogTitle>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2"><span className="inline-block size-2 rounded-full bg-emerald-500" />Processed</div>
            </div>
          </div>
        </DialogHeader>
        <div className="shrink-0 flex items-center gap-4 p-4 pb-2">
          <Avatar className="size-10">
            <AvatarFallback className="text-[11px]">{getInitials(title)}</AvatarFallback>
          </Avatar>
          <div className="text-base font-semibold">{title}</div>
        </div>
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <Tabs defaultValue="matches" className="flex-1 flex flex-col min-h-0">
            <TabsList className="bg-transparent h-12 p-0 border-b w-full justify-start rounded-none">
              <TabsTrigger value="matches" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-12 px-6">Matches</TabsTrigger>
              <TabsTrigger value="profile" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-12 px-6">Job Profile</TabsTrigger>
              <TabsTrigger value="raw" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-12 px-6">Raw Data</TabsTrigger>
            </TabsList>
            <TabsContent value="matches" className="flex-1 min-h-0 overflow-y-auto p-3">
              <div className="rounded border bg-background">
                <table className="w-full text-sm">
                  <thead className="bg-background">
                    <tr>
                      <th className="text-left p-2 w-8">#</th>
                      <th className="text-left p-2">Candidate</th>
                      <th className="text-left p-2">% Score</th>
                      <th className="text-left p-2">Matched</th>
                      <th className="text-left p-2">Imported</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(matchRows ?? []).map((row, idx) => (
                      <tr key={row.id} className="border-t border-[var(--border)]">
                        <td className="p-2 text-center text-neutral-400">{idx + 1}</td>
                        <td className="p-2">
                          <div className="font-medium truncate">{row.name}</div>
                        </td>
                        <td className="p-2">
                          <div className="flex items-center gap-2">
                            <div className="w-28">
                              <Progress value={row.scorePct} className="h-2" />
                            </div>
                            <span className="tabular-nums text-xs text-neutral-300">{row.scorePct}%</span>
                          </div>
                        </td>
                        <td className="p-2 text-xs text-neutral-300">{row.matchedAt}</td>
                        <td className="p-2 text-xs text-neutral-300">{row.importedAt}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>
            <TabsContent value="profile" className="overflow-y-auto p-3">
              {job ? (
                <div className="space-y-6 text-sm">
                  {job?.summary && (
                    <div className="space-y-2">
                      <div className="font-medium">Summary</div>
                      <p className="whitespace-pre-wrap">{job.summary}</p>
                    </div>
                  )}
                  {Array.isArray(job?.responsibilities) && job.responsibilities.length > 0 && (
                    <div className="space-y-2">
                      <div className="font-medium">Responsibilities</div>
                      <ul className="list-disc pl-5 space-y-1">
                        {job.responsibilities.map((r: string, i: number) => (
                          <li key={i} className="whitespace-pre-wrap">{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {Array.isArray(job?.requirements) && job.requirements.length > 0 && (
                    <div className="space-y-2">
                      <div className="font-medium">Requirements</div>
                      <ul className="list-disc pl-5 space-y-1">
                        {job.requirements.map((r: string, i: number) => (
                          <li key={i} className="whitespace-pre-wrap">{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {Array.isArray(job?.skills) && job.skills.length > 0 && (
                    <div className="space-y-2">
                      <div className="font-medium">Skills</div>
                      <div className="flex flex-wrap gap-2">
                        {job.skills.map((s: any, i: number) => (
                          <Badge key={i} variant="outline" className="px-2 py-1">{s?.name}{typeof s?.score === "number" ? ` (${s.score})` : ""}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {!job?.summary && (!job?.skills || job.skills.length === 0) && (
                    <div className="text-sm text-neutral-400">No profile yet</div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-neutral-400">No profile yet</div>
              )}
            </TabsContent>
            <TabsContent value="raw" className="overflow-y-auto p-3">
              {source ? (
                <pre className="bg-neutral-900/60 rounded p-3 overflow-x-auto text-xs">
{JSON.stringify(source, null, 2)}
                </pre>
              ) : (
                <div className="text-sm text-neutral-400">No raw data</div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}

