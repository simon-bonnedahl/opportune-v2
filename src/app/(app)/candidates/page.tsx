/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, @next/next/no-img-element */
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
import { useEffect, useRef } from "react";
import { formatDate } from "@/lib/format";

export default function CandidatesPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [queryText, setQueryText] = useState<string>("");

  const candidates = useQuery(api.teamtailor.getCandidates) as any[] | undefined;

  const candidateIds = useMemo(
    () => (candidates ?? []).map((c: any) => c._id as any),
    [candidates]
  );
  const processing = useQuery(
    api.teamtailor.getProcessingStatusByCandidateIds as any,
    { candidateIds: (candidateIds as any[]) ?? [] } as any
  ) as any[] | undefined;

  const rows = useMemo(() => {
    const base = (candidates ?? []).slice();
    const filtered = queryText.trim().length
      ? base.filter((r: any) =>
          (r.name ?? "").toLowerCase().includes(queryText.toLowerCase())
        )
      : base;
    return filtered.sort(
      (a: any, b: any) =>
        (b.updatedAt ?? b._creationTime) - (a.updatedAt ?? a._creationTime)
    );
  }, [candidates, queryText]);

  const enqueueImport = useMutation(api.teamtailor.enqueueCandidateImports);

  const onAddCandidate = async () => {
    const id = window.prompt("Teamtailor candidate ID");
    if (!id) return;
    try {
      await enqueueImport({ candidateIds: [id] } as any);
    } catch (e) {
      console.warn(e);
    }
  };

  return (
    <div className="w-full px-6 py-8">
      <div className="flex items-center justify-between mb-4">
        <div className="text-xl font-semibold">Candidates</div>
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
          <Button onClick={onAddCandidate} size="sm" className="h-8">
            + Add Candidate
          </Button>
        </div>
      </div>

      <div className="rounded border border-[var(--border)] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-accent/40 dark:bg-neutral-900">
            <tr>
              <th className="text-left p-2 w-[40%]">Name</th>
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
                      {r?.imageUrl ? (
                        <img src={r.imageUrl} alt={r.name} className="h-full w-full object-cover rounded-full" />
                      ) : (
                        <AvatarFallback className="text-[11px]">
                          {getInitials(r.name)}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div className="font-medium truncate">{r.name}</div>
                  </div>
                </td>
                <td className="p-2">
                  <div className="flex flex-wrap gap-1">
                    {getCandidateTags(r).slice(0, 4).map((t) => (
                      <Badge key={t} variant="outline" className="px-1 py-0 text-[11px]">
                        {t}
                      </Badge>
                    ))}
                    {getCandidateTags(r).length > 4 && (
                      <Badge variant="secondary" className="px-1 py-0 text-[11px]">
                        +{getCandidateTags(r).length - 4}
                      </Badge>
                    )}
                  </div>
                </td>
                <td className="p-2"></td>
                <td className="p-2">
                  <StatusPill candidateId={r._id} processing={processing} />
                </td>
                <td className="p-2 whitespace-nowrap">
                  {formatDate(r.updatedAt ?? r._creationTime, { month: "short" })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedId && (
        <CandidateDialog id={selectedId} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}

function getInitials(name?: string) {
  if (!name) return "?";
  const parts = name.split(" ").filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

function getCandidateTags(row: any): string[] {
  const tags: string[] = [];
  const attrs = row?.rawData?.attributes ?? {};
  if (Array.isArray(attrs?.tags)) {
    for (const t of attrs.tags) if (typeof t === "string") tags.push(t);
  }
  const city: string | undefined = attrs?.city || attrs?.location || attrs?.["location-name"];
  if (city) tags.push(city);
  return tags;
}

// Best match column intentionally left blank for now

function StatusPill({ candidateId, processing }: { candidateId: string; processing: any[] | undefined }) {
  const row = (processing ?? []).find((p: any) => (p?.candidateId as any) === (candidateId as any));
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

function CandidateDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const [candidate] = (useQuery(api.candidates.getProfilesByCandidateIds as any, { candidateIds: [id as any] } as any) as any[] | undefined) ?? [];
  const [source] = (useQuery(api.candidates.getSourceDataByCandidateIds as any, { candidateIds: [id as any] } as any) as any[] | undefined) ?? [];
  const allCandidates = useQuery(api.teamtailor.getCandidates) as any[] | undefined;
  const core = (allCandidates ?? []).find((c: any) => String(c._id) === String(id));
  const [open, setOpen] = useState(true);
  const close = () => {
    setOpen(false);
    onClose();
  };
  const displayName = core?.name ?? "Candidate";
  const initials = getInitials(displayName);
  const importedAt = (core?.updatedAt ?? candidate?.updatedAt)
    ? new Date((core?.updatedAt ?? candidate?.updatedAt) as number).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : "";
  const matches = useQuery(api.matches.listMatchesForCandidate as any, { candidateId: id as any, limit: 100 } as any) as any[] | undefined;
  const jobs = useQuery(api.teamtailor.getJobs) as any[] | undefined;
  const matchRows = (matches ?? []).map((m: any) => {
    const job = (jobs ?? []).find((j: any) => String(j._id) === String(m.jobId));
    const title = job?.rawData?.attributes?.title ?? String(m.jobId);
    const locations: string[] = [];
    const attrs = job?.rawData?.attributes ?? {};
    if (typeof attrs?.location === "string") locations.push(attrs.location);
    if (typeof attrs?.["location-name"] === "string") locations.push(attrs["location-name"]);
    const matchedAt = new Date(m.updatedAt ?? m._creationTime).toLocaleString();
    const importedAt = job ? new Date(job.updatedAt ?? job._creationTime).toLocaleDateString() : "";
    return {
      id: String(m._id),
      title,
      scorePct: Math.round((Number(m.score) || 0) * 100),
      locations,
      matchedAt,
      importedAt,
    };
  });
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) close(); }}>
      <DialogContent className="h-[85vh] overflow-hidden flex flex-col w-full max-w-[calc(100%-2rem)] sm:!max-w-[95vw] xl:!max-w-[1200px]">
        <DialogHeader className="border-b">
          <div className="flex items-center justify-between p-2">
            <div className="flex items-center gap-3">
              <Avatar className="size-10">
                <AvatarFallback className="text-[11px]">{initials || "?"}</AvatarFallback>
              </Avatar>
              <DialogTitle className="text-base font-semibold leading-none">{displayName}</DialogTitle>
            </div>
            <div className="flex items-center gap-3 text-xs">
              {importedAt && <div>{importedAt}</div>}
              <div className="flex items-center gap-2"><span className="inline-block size-2 rounded-full bg-emerald-500" />Processed</div>
            </div>
          </div>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <Tabs defaultValue="matches" className="flex-1 flex flex-col min-h-0">
            <AnimatedTabList />
            <TabsContent value="matches" className="flex-1 flex flex-col min-h-0 p-2">
              <div className="px-2 pb-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Input placeholder="Search..." className="h-8 w-60" />
                  <Button variant="outline" size="sm" className="h-8">Default</Button>
                  <Button variant="outline" size="sm" className="h-8">Date</Button>
                  <Button variant="outline" size="sm" className="h-8">Tags</Button>
                  <Button variant="outline" size="sm" className="h-8">Score</Button>
                </div>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto rounded border bg-background">
                <table className="w-full text-sm">
                  <thead className="bg-background">
                    <tr>
                      <th className="text-left p-2 w-8">#</th>
                      <th className="text-left p-2">Job</th>
                      <th className="text-left p-2">% Score</th>
                      <th className="text-left p-2">Locations</th>
                      <th className="text-left p-2">Matched</th>
                      <th className="text-left p-2">Imported</th>
                      <th className="text-left p-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(matchRows ?? []).map((row, idx) => (
                      <tr key={row.id} className="border-t border-[var(--border)]">
                        <td className="p-2 text-center text-neutral-400">{idx + 1}</td>
                        <td className="p-2">
                          <div className="font-medium truncate">{row.title}</div>
                        </td>
                        <td className="p-2">
                          <div className="flex items-center gap-2">
                            <div className="w-28">
                              <Progress value={row.scorePct} className="h-2" />
                            </div>
                            <span className="tabular-nums text-xs text-neutral-300">{row.scorePct}%</span>
                          </div>
                        </td>
                        <td className="p-2">
                          <div className="flex flex-wrap gap-1">
                            {row.locations.map((t: string) => (
                              <Badge key={t} variant="outline" className="px-1 py-0 text-[11px]">{t}</Badge>
                            ))}
                          </div>
                        </td>
                        <td className="p-2 text-xs text-neutral-300">{row.matchedAt}</td>
                        <td className="p-2 text-xs text-neutral-300">{row.importedAt}</td>
                        <td className="p-2 text-xs text-neutral-300">...</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="shrink-0 flex items-center justify-center gap-2 py-3 border-t mt-2">
                <Button variant="outline" size="icon">«</Button>
                <Button variant="outline" size="sm">-5</Button>
                <Button variant="outline" size="icon">‹</Button>
                <span className="text-sm px-2">1 / 1</span>
                <Button variant="outline" size="icon">›</Button>
                <Button variant="outline" size="sm">+5</Button>
                <Button variant="outline" size="icon">»</Button>
              </div>
            </TabsContent>
            <TabsContent value="profile" className="overflow-y-auto p-3">
              {candidate ? (
                <div className="space-y-6 text-sm">
                  {candidate?.summary && (
                    <div className="space-y-2">
                      <div className="font-medium">Summary</div>
                      <p className="whitespace-pre-wrap">{candidate.summary}</p>
                    </div>
                  )}

                  {Array.isArray(candidate?.education) && candidate.education.length > 0 && (
                    <div className="space-y-2">
                      <div className="font-medium">Education</div>
                      <ul className="space-y-2 list-disc pl-5">
                        {candidate.education.map((e: any, i: number) => (
                          <li key={i} className="space-y-0.5">
                            <div className="font-medium">{e?.degree || e?.field || e?.institution || "Education"}</div>
                            <div className="text-neutral-400">
                              {[e?.institution, e?.field].filter(Boolean).join(" • ")}
                            </div>
                            <div className="text-neutral-500">{[e?.startDate, e?.endDate].filter(Boolean).join(" – ")}</div>
                            {e?.notes && <div className="whitespace-pre-wrap">{e.notes}</div>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {Array.isArray(candidate?.skills) && candidate.skills.length > 0 && (
                    <div className="space-y-2">
                      <div className="font-medium">Skills</div>
                      <div className="flex flex-wrap gap-2">
                        {candidate.skills.map((s: any, i: number) => (
                          <Badge key={i} variant="outline" className="px-2 py-1">
                            {s?.name}{typeof s?.score === "number" ? ` (${s.score})` : ""}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {Array.isArray(candidate?.workExperience) && candidate.workExperience.length > 0 && (
                    <div className="space-y-2">
                      <div className="font-medium">Work Experience</div>
                      <ul className="space-y-3 list-disc pl-5">
                        {candidate.workExperience.map((w: any, i: number) => (
                          <li key={i} className="space-y-1">
                            <div className="font-medium">{[w?.title, w?.company].filter(Boolean).join(" @ ")}</div>
                            <div className="text-neutral-500">{[w?.startDate, w?.endDate].filter(Boolean).join(" – ")}</div>
                            {Array.isArray(w?.responsibilities) && w.responsibilities.length > 0 && (
                              <ul className="list-disc pl-5 space-y-1">
                                {w.responsibilities.map((r: string, j: number) => (
                                  <li key={j} className="whitespace-pre-wrap">{r}</li>
                                ))}
                              </ul>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {!candidate?.summary && (!candidate?.skills || candidate.skills.length === 0) && (
                    <div className="text-sm text-neutral-400">No profile yet</div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-neutral-400">No profile yet</div>
              )}
            </TabsContent>
            <TabsContent value="assessment" className="overflow-y-auto p-3">
              {typeof source?.assessment === "string" && source.assessment.trim().length > 0 ? (
                <div className="space-y-2 text-sm">
                  <div className="font-medium">Assessment</div>
                  <p className="whitespace-pre-wrap">{source.assessment}</p>
                </div>
              ) : (
                <div className="text-sm text-neutral-400">No assessment</div>
              )}
            </TabsContent>
            <TabsContent value="cv" className="overflow-y-auto p-3">
              {source?.cv?.summary ? (
                <div className="space-y-2 text-sm">
                  <div className="font-medium">CV Summary</div>
                  {typeof source.cv.summary === "string" ? (
                    <p className="whitespace-pre-wrap">{source.cv.summary}</p>
                  ) : (
                    <pre className="bg-neutral-900/60 rounded p-3 overflow-x-auto text-xs">
{JSON.stringify(source.cv.summary, null, 2)}
                    </pre>
                  )}
                </div>
              ) : (
                <div className="text-sm text-neutral-400">No CV</div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AnimatedTabList() {
  const listRef = useRef<HTMLDivElement | null>(null);
  const updateIndicator = () => {
    const el = listRef.current;
    if (!el) return;
    const active = el.querySelector('[data-state="active"]') as HTMLElement | null;
    if (!active) return;
    const containerRect = el.getBoundingClientRect();
    const targetRect = active.getBoundingClientRect();
    const left = targetRect.left - containerRect.left;
    const width = targetRect.width;
    const indicator = el.querySelector('[data-indicator]') as HTMLDivElement | null;
    if (indicator) {
      indicator.style.transform = `translateX(${left}px)`;
      indicator.style.width = `${width}px`;
    }
  };
  useEffect(() => {
    updateIndicator();
    const ro = new ResizeObserver(() => updateIndicator());
    if (listRef.current) ro.observe(listRef.current);
    window.addEventListener('resize', updateIndicator);
    return () => {
      window.removeEventListener('resize', updateIndicator);
      ro.disconnect();
    };
  }, []);
  const onValueChange = () => {
    // schedule after DOM state updates
    requestAnimationFrame(updateIndicator);
  };
  return (
    <TabsList
      ref={listRef as any}
      className="relative h-11 p-0 border-b w-full justify-start rounded-none bg-transparent"
      onClick={onValueChange as any}
    >
      <div
        data-indicator
        aria-hidden
        className="absolute bottom-0 left-0 h-[2px] bg-primary transition-[transform,width] duration-300 ease-out"
        style={{ width: 0, transform: 'translateX(0)' }}
      />
      <TabsTrigger value="matches" className="h-11 px-5 rounded-none text-muted-foreground data-[state=active]:text-foreground bg-transparent data-[state=active]:bg-transparent">Matches</TabsTrigger>
      <TabsTrigger value="profile" className="h-11 px-5 rounded-none text-muted-foreground data-[state=active]:text-foreground bg-transparent data-[state=active]:bg-transparent">Candidate Profile</TabsTrigger>
      <TabsTrigger value="assessment" className="h-11 px-5 rounded-none text-muted-foreground data-[state=active]:text-foreground bg-transparent data-[state=active]:bg-transparent">Assessment</TabsTrigger>
      <TabsTrigger value="cv" className="h-11 px-5 rounded-none text-muted-foreground data-[state=active]:text-foreground bg-transparent data-[state=active]:bg-transparent">CV</TabsTrigger>
    </TabsList>
  );
}

