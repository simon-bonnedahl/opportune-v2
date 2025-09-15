"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useAction, usePaginatedQuery } from "convex/react";
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
import type { CandidateDoc, Id, JobDoc, MatchDoc, CandidateProcessingStatus, Doc } from "@/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { CandidatesTable } from "@/components/candidates/candidates-table";
import { useDebounce } from "@/hooks/use-debounce";
import { toast } from "sonner";
import { Plus } from "lucide-react";

export default function CandidatesPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState<string>("");
  const debouncedSearchText = useDebounce(searchText, 500);

  const addCandidate = useAction(api.candidates.add);

  const totalCount = useQuery(api.candidates.getCandidatesCount, { search: debouncedSearchText }) as number | undefined;
  const { results, status, loadMore } = usePaginatedQuery(
		api.candidates.listPaginated,
		{ search: debouncedSearchText },
		{ initialNumItems: 50 }
	)

  const handleSearch = (value: string) => {
    setSearchText(value);
  };

  const handleAddCandidate = async () => {
    const teamtailorId = window.prompt("Enter TeamTailor Candidate ID:");
    if (!teamtailorId?.trim()) return;
    
    try {
      await addCandidate({ teamtailorId: teamtailorId.trim() });
      toast.success("Candidate import started successfully!");
    } catch (error) {
      console.error("Failed to add candidate:", error);
      toast.error("Failed to start candidate import. Please try again.");
    }
  };

  return (
    <div className="w-full px-4 py-4">
      <Card className="max-w-7xl mx-auto">
        <div className="flex flex-wrap items-center justify-between p-4 border-b">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold">Candidates</h1>
            <div className="text-md text-muted-foreground">
              {typeof totalCount === "number" ? (
                <span>Showing {results.length} of {totalCount} candidates</span>
              ) : (
                <Skeleton className="h-4 w-32" />
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Input
              placeholder="Search candidates..."
              value={searchText}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-64"
            />
          
            
            <Button onClick={handleAddCandidate} size="sm">
              <Plus className="h-4 w-4" />

               Add Candidate
            </Button>
          </div>
        </div>

        <CandidatesTable
          data={results}
          isLoading={status === "LoadingFirstPage"}
          onRowClick={setSelectedId}
        />
      </Card>

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

function CandidateDialog({ id, onClose }: { id: string; onClose: () => void }) {
  type CandidateProfileDoc = Doc<"candidateProfiles">;
  type CandidateSourceData = Doc<"candidateSourceData">;
  const [candidate] = (useQuery(api.candidates.getProfilesByCandidateIds, { candidateIds: [id as unknown as Id<"candidates">] }) as CandidateProfileDoc[] | undefined) ?? [];
  const [source] = (useQuery(api.candidates.getSourceDataByCandidateIds, { candidateIds: [id as unknown as Id<"candidates">] }) as CandidateSourceData[] | undefined) ?? [];
  const core = useQuery(api.candidates.getCandidateById, { candidateId: id as unknown as Id<"candidates"> }) as CandidateDoc | undefined;
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
  const matches = useQuery(api.matches.listMatchesForCandidate, { candidateId: id as unknown as Id<"candidates">, limit: 100 }) as MatchDoc[] | undefined;
  const [selectedModel, setSelectedModel] = useState<string>("gpt-5");
  const availableModels = useMemo(() => {
    const set = new Set<string>();
    for (const m of matches ?? []) {
      const v = typeof m?.model === "string" ? m.model : undefined;
      if (v) set.add(v);
    }
    set.add("gpt-5");
    return Array.from(set).sort();
  }, [matches]);
  const filteredMatches = useMemo(() => {
    return (matches ?? []).filter((m) => ((m?.model ?? "unknown") === selectedModel));
  }, [matches, selectedModel]);
  const jobs = useQuery(api.jobs.getJobs) as JobDoc[] | undefined;
  const matchRows = (filteredMatches ?? []).map((m) => {
    const job = (jobs ?? []).find((j) => String(j._id) === String(m.jobId));
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
                  <Select value={selectedModel} onValueChange={setSelectedModel}>
                    <SelectTrigger className="h-8 w-40">
                      <SelectValue placeholder="Model" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableModels.map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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

                  {candidate?.description && (
                    <div className="space-y-2">
                      <div className="font-medium">Description</div>
                      <p className="whitespace-pre-wrap">{candidate.description}</p>
                    </div>
                  )}

                  {Array.isArray(candidate?.education) && candidate.education.length > 0 && (
                    <div className="space-y-2">
                      <div className="font-medium">Education</div>
                      <ul className="space-y-2 list-disc pl-5">
                        {candidate.education.map((e, i: number) => (
                          <li key={i} className="space-y-0.5">
                            <div className="font-medium">{e || "Education"}</div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {Array.isArray(candidate?.technicalSkills) && candidate.technicalSkills.length > 0 && (
                    <div className="space-y-2">
                      <div className="font-medium">Technical Skills</div>
                      <div className="flex flex-wrap gap-2">
                        {candidate.technicalSkills.map((s, i: number) => (
                          <Badge key={i} variant="outline" className="px-2 py-1">
                            {s?.name}{typeof s?.score === "number" ? ` (${s.score})` : ""}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {Array.isArray(candidate?.softSkills) && candidate.softSkills.length > 0 && (
                    <div className="space-y-2">
                      <div className="font-medium">Soft Skills</div>
                      <div className="flex flex-wrap gap-2">
                        {candidate.softSkills.map((s, i: number) => (
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
                        {candidate.workExperience.map((w, i: number) => (
                          <li key={i} className="space-y-1">
                            <div className="font-medium">{w || "Work Experience"}</div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {Array.isArray(candidate?.preferences) && candidate.preferences.length > 0 && (
                    <div className="space-y-2">
                      <div className="font-medium">Preferences</div>
                      <ul className="space-y-2 list-disc pl-5">
                        {candidate.preferences.map((p, i: number) => (
                          <li key={i} className="space-y-1">
                            <div className="font-medium">{p || "Preference"}</div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {Array.isArray(candidate?.aspirations) && candidate.aspirations.length > 0 && (
                    <div className="space-y-2">
                      <div className="font-medium">Aspirations</div>
                      <ul className="space-y-2 list-disc pl-5">
                        {candidate.aspirations.map((a, i: number) => (
                          <li key={i} className="space-y-1">
                            <div className="font-medium">{a || "Aspiration"}</div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {!candidate?.summary && !candidate?.description && (!candidate?.technicalSkills || candidate.technicalSkills.length === 0) && (!candidate?.softSkills || candidate.softSkills.length === 0) && (
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
              {source?.resumeSummary ? (
                <div className="space-y-2 text-sm">
                  <div className="font-medium">Resume Summary</div>
                  <p className="whitespace-pre-wrap">{source.resumeSummary}</p>
                </div>
              ) : (
                <div className="text-sm text-neutral-400">No resume summary available</div>
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

