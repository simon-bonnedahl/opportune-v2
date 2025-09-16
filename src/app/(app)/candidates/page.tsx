"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useAction, usePaginatedQuery } from "convex/react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { CandidatesTable } from "@/components/candidates/candidates-table";
import { ProfileInfoTooltip } from "@/components/ui/profile-info-tooltip";
import { useDebounce } from "@/hooks/use-debounce";
import { toast } from "sonner";
import { Plus, Info } from "lucide-react";
import { api, Id } from "@/lib/convex";

export default function CandidatesPage() {
  const [selectedId, setSelectedId] = useState<Id<"candidates"> | null>(null);
  const [searchText, setSearchText] = useState<string>("");
  const debouncedSearchText = useDebounce(searchText, 500);

  const addCandidate = useAction(api.candidates.add);

  const totalCount = useQuery(api.candidates.getCandidatesCount, { search: debouncedSearchText }) as number | undefined;
  const { results, status } = usePaginatedQuery(
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

function CandidateDialog({ id, onClose }: { id: Id<"candidates">; onClose: () => void }) {
  const profile = useQuery(api.candidates.getProfile, { candidateId: id  }) 
  const sourceData = useQuery(api.candidates.getSourceData, { candidateId: id  }) 
  const candidate = useQuery(api.candidates.get, { candidateId: id  })
  const [open, setOpen] = useState(true);
  const close = () => {
    setOpen(false);
    onClose();
  };

  const initials = getInitials(candidate?.name);

  const matches = []
  const [selectedModel, setSelectedModel] = useState<string>("gpt-5");
 
  

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) close(); }}>
      <DialogContent className="h-[85vh] overflow-hidden flex flex-col w-full max-w-[calc(100%-2rem)] sm:!max-w-[95vw] xl:!max-w-[1200px]">
        <DialogHeader className="border-b">
          <div className="flex items-center justify-between p-2">
            <div className="flex items-center gap-3">
              <Avatar className="size-10">
                <AvatarFallback className="text-[11px]">{initials || "?"}</AvatarFallback>
              </Avatar>
              <DialogTitle className="text-base font-semibold leading-none">{candidate?.name}</DialogTitle>
            </div>
            <div className="flex items-center gap-3 text-xs">
              {candidate?._creationTime && <div>{new Date(candidate._creationTime).toLocaleDateString()}</div>}
              <div className="flex items-center gap-2"><span className="inline-block size-2 rounded-full bg-emerald-500" />Processed</div>
            </div>
          </div>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <Tabs defaultValue="matches" className="flex-1 flex flex-col min-h-0">
            <AnimatedTabList profile={profile} />
            <TabsContent value="matches" className="flex-1 flex flex-col min-h-0 p-2">
              <div className="px-2 pb-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Input placeholder="Search..." className="h-8 w-60" />
                 
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
            <TabsContent value="profile" className="overflow-y-auto p-3 relative">
              {candidate ? (
                <div className="space-y-6 text-sm">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Profile</h3>
                    <ProfileInfoTooltip 
                      modelId={profile?.metadata?.modelId} 
                      confidence={profile?.metadata?.confidence}
                    >
                      <div>
                        <Info className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
                      </div>
                    </ProfileInfoTooltip>
                  </div>
                  {profile?.description && (
                    <div className="space-y-2">
                      <div className="font-medium">Description</div>
                      <p className="whitespace-pre-wrap">{profile.description}</p>
                    </div>
                  )}
                  {profile?.summary && (
                    <div className="space-y-2">
                      <div className="font-medium">Summary</div>
                      <p className="whitespace-pre-wrap">{profile.summary}</p>
                    </div>
                  )}

                  

                  {Array.isArray(profile?.education) && profile.education.length > 0 && (
                    <div className="space-y-2">
                      <div className="font-medium">Education</div>
                      <ul className="space-y-2 list-disc pl-5">
                        {profile.education.map((e: string, i: number) => (
                          <li key={i} className="space-y-0.5">
                            <div className="font-medium">{e || "Education"}</div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {Array.isArray(profile?.technicalSkills) && profile.technicalSkills.length > 0 && (
                    <div className="space-y-2">
                      <div className="font-medium">Technical Skills</div>
                      <div className="flex flex-wrap gap-2">
                        {profile.technicalSkills.map((s: any, i: number) => (
                          <Badge key={i} variant="outline" className="px-2 py-1">
                            {s?.name}{typeof s?.score === "number" ? ` (${s.score})` : ""}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {Array.isArray(profile?.softSkills) && profile.softSkills.length > 0 && (
                    <div className="space-y-2">
                      <div className="font-medium">Soft Skills</div>
                      <div className="flex flex-wrap gap-2">
                        {profile.softSkills.map((s: any, i: number) => (
                          <Badge key={i} variant="outline" className="px-2 py-1">
                            {s?.name}{typeof s?.score === "number" ? ` (${s.score})` : ""}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {Array.isArray(profile?.workExperience) && profile.workExperience.length > 0 && (
                    <div className="space-y-2">
                      <div className="font-medium">Work Experience</div>
                      <ul className="space-y-3 list-disc pl-5">
                          {profile.workExperience.map((w: string, i: number) => (
                          <li key={i} className="space-y-1">
                            <div className="font-medium">{w || "Work Experience"}</div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {Array.isArray(profile?.preferences) && profile.preferences.length > 0 && (
                    <div className="space-y-2">
                      <div className="font-medium">Preferences</div>
                      <ul className="space-y-2 list-disc pl-5">
                        {profile.preferences.map((p: string, i: number) => (
                          <li key={i} className="space-y-1">
                            <div className="font-medium">{p || "Preference"}</div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {Array.isArray(profile?.aspirations) && profile.aspirations.length > 0 && (
                    <div className="space-y-2">
                      <div className="font-medium">Aspirations</div>
                      <ul className="space-y-2 list-disc pl-5">
                        {profile.aspirations.map((a: string, i: number) => (
                          <li key={i} className="space-y-1">
                            <div className="font-medium">{a || "Aspiration"}</div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {!profile?.summary && !profile?.description && (!profile?.technicalSkills || profile.technicalSkills.length === 0) && (!profile?.softSkills || profile.softSkills.length === 0) && (
                    <div className="text-sm text-neutral-400">No profile yet</div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-neutral-400">No profile yet</div>
              )}
            </TabsContent>
            <TabsContent value="assessment" className="overflow-y-auto p-3">
              {typeof sourceData?.assessment === "string" && sourceData.assessment.trim().length > 0 ? (
                <div className="space-y-2 text-sm">
                  <div className="font-medium">Assessment</div>
                  <p className="whitespace-pre-wrap">{sourceData.assessment}</p>
                </div>
              ) : (
                <div className="text-sm text-neutral-400">No assessment</div>
              )}
            </TabsContent>
            <TabsContent value="cv" className="overflow-y-auto p-3">
              {sourceData?.resumeSummary ? (
                <div className="space-y-2 text-sm">
                  <div className="font-medium">Resume Summary</div>
                  <p className="whitespace-pre-wrap">{sourceData.resumeSummary}</p>
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

function AnimatedTabList({ profile }: { profile?: any }) {
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
      ref={listRef as React.RefObject<HTMLDivElement>}
      className="relative h-11 p-0 border-b w-full justify-start rounded-none bg-transparent"
      onClick={onValueChange as React.MouseEventHandler<HTMLDivElement>}
    >
      <div
        data-indicator
        aria-hidden
        className="absolute bottom-0 left-0 h-[2px] bg-primary transition-[transform,width] duration-300 ease-out"
        style={{ width: 0, transform: 'translateX(0)' }}
      />
      <TabsTrigger value="matches" className="h-11 px-5 rounded-none text-muted-foreground data-[state=active]:text-foreground bg-transparent data-[state=active]:bg-transparent">Matches</TabsTrigger>
      <TabsTrigger value="profile" className="h-11 px-5 rounded-none text-muted-foreground data-[state=active]:text-foreground bg-transparent data-[state=active]:bg-transparent">Profile</TabsTrigger>
      <TabsTrigger value="assessment" className="h-11 px-5 rounded-none text-muted-foreground data-[state=active]:text-foreground bg-transparent data-[state=active]:bg-transparent">Assessment</TabsTrigger>
      <TabsTrigger value="cv" className="h-11 px-5 rounded-none text-muted-foreground data-[state=active]:text-foreground bg-transparent data-[state=active]:bg-transparent">CV</TabsTrigger>
    </TabsList>
  );
}

