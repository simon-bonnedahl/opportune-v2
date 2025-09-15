"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { formatDate } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CandidateDoc, Id, JobDoc, JobProcessingStatus, JobProfileDoc } from "@/types";
import { JobsTable } from "@/components/jobs/jobs-table";
import { useDebounce } from "@/hooks/use-debounce";
import { toast } from "sonner";

export default function JobsPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState<string>("");
  const debouncedSearchText = useDebounce(searchText, 500);
  const [sortMode, setSortMode] = useState<"updated-at" | "created-at">("updated-at");
  const [pagination, setPagination] = useState({
    currentPage: 1,
    perPage: 25,
    totalPages: 1,
    totalCount: 0,
    hasNext: false,
    hasPrev: false,
  });
  const [jobsData, setJobsData] = useState<JobDoc[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const addJob = useAction(api.jobs.add);

  const totalCount = useQuery(api.jobs.getJobsCount, { search: debouncedSearchText }) as number | undefined;
  const jobsQuery = useQuery(api.jobs.listJobsPaginated, {
    search: debouncedSearchText,
    page: pagination.currentPage,
    perPage: pagination.perPage,
    sortBy: `-${sortMode}`,
  });

  // Get processing statuses for the current page of jobs
  const jobIds = jobsData.map(j => j._id);
  const processingStatuses = useQuery(api.jobs.getProcessingStatusByJobIds, { 
    jobIds: jobIds as Id<"jobs">[] 
  }) as Array<{
    jobId: string;
    status: "queued" | "running" | "succeeded" | "failed" | "canceled" | "none" | "unknown";
    progress: number;
    progressMessage: string;
    errorMessage: string;
  }> | undefined;

  // Update jobs data when query results change
  useEffect(() => {
    if (jobsQuery) {
      setJobsData(jobsQuery.jobs);
      setPagination(jobsQuery.pagination);
    }
  }, [jobsQuery]);

  // Reset pagination when search text changes (debounced)
  useEffect(() => {
    setPagination(prev => ({ ...prev, currentPage: 1 }));
  }, [debouncedSearchText]);

  const handleSearch = (value: string) => {
    setSearchText(value);
  };

  const handlePageChange = (page: number, perPage: number, sort?: string) => {
    setPagination(prev => ({ ...prev, currentPage: page, perPage }));
  };

  const handleSortModeChange = (newSortMode: "updated-at" | "created-at") => {
    setSortMode(newSortMode);
    setPagination(prev => ({ ...prev, currentPage: 1 })); // Reset to page 1 when changing sort
  };

  const handleAddJob = async () => {
    const teamtailorId = window.prompt("Enter TeamTailor Job ID:");
    if (!teamtailorId?.trim()) return;
    
    try {
      await addJob({ teamtailorId: teamtailorId.trim() });
      toast.success("Job import started successfully!");
    } catch (error) {
      console.error("Failed to add job:", error);
      toast.error("Failed to start job import. Please try again.");
    }
  };

  return (
    <div className="w-full px-4 py-4">
      <Card className="max-w-7xl mx-auto">
        <div className="flex flex-wrap items-center justify-between p-4 border-b">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold">Jobs</h1>
            <div className="text-md text-muted-foreground">
              {typeof totalCount === "number" ? (
                <span>Showing {jobsData.length} of {totalCount} jobs</span>
              ) : (
                <Skeleton className="h-4 w-32" />
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Input
              placeholder="Search jobs..."
              value={searchText}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-64"
            />
            
            <Select value={sortMode} onValueChange={handleSortModeChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="updated-at">Last Updated</SelectItem>
                <SelectItem value="created-at">Date Created</SelectItem>
              </SelectContent>
            </Select>
            
            <Button onClick={handleAddJob} size="sm">
              + Add Job
            </Button>
          </div>
        </div>

        <JobsTable
          data={jobsData}
          isLoading={isLoading}
          pagination={pagination}
          onPageChange={handlePageChange}
          onRowClick={setSelectedId}
          processingStatuses={processingStatuses || []}
        />
      </Card>

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

function JobDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const [job] = (useQuery(api.jobs.getJobProfilesByJobIds, { jobIds: [id as unknown as Id<"jobs">] }) as JobProfileDoc[] | undefined) ?? [];
  type JobSourceData = {
    jobId: Id<"jobs">;
    body?: string;
    links?: Record<string, string>;
    tags?: string[];
    recruiterEmail?: string;
    remoteStatus?: string;
    languageCode?: string;
    mailbox?: string;
    humanStatus?: string;
    internal?: boolean;
    createdAt?: number;
    startDate?: number;
    endDate?: number;
    updatedAt: number;
  };
  // Note: Job source data query not available in new API yet
  const source = null;
  const core = useQuery(api.jobs.getJobById, { jobId: id as unknown as Id<"jobs"> }) as JobDoc | undefined;
  const matches = useQuery(api.matches.listMatchesForJob, { jobId: id as unknown as Id<"jobs">, limit: 100 }) as import("@/types").MatchDoc[] | undefined;
  const candidates = useQuery(api.candidates.list) as CandidateDoc[] | undefined;
  const [open, setOpen] = useState(true);
  const close = () => { setOpen(false); onClose(); };
  const title = core?.rawData?.attributes?.title ?? core?.title ?? "Job";
  const matchRows = (matches ?? []).map((m) => {
    const cand = (candidates ?? []).find((c) => String(c._id) === String(m.candidateId));
    const name = cand?.name ?? String(m.candidateId);
    const matchedAt = new Date(m.updatedAt ?? m._creationTime).toLocaleString();
    const importedAt = cand ? new Date((cand as CandidateDoc).updatedAt ?? (cand as CandidateDoc)._creationTime).toLocaleDateString() : "";
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
                        {job.skills.map((s, i: number) => (
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

