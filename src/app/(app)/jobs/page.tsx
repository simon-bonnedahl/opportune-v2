"use client";

import { useState } from "react";
import { useQuery, useAction, usePaginatedQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { JobsTable } from "@/components/jobs/jobs-table";
import { ProfileInfoTooltip } from "@/components/ui/profile-info-tooltip";
import { useDebounce } from "@/hooks/use-debounce";
import { toast } from "sonner";
import { Plus, Info } from "lucide-react";
import { Id } from "@/lib/convex";


export default function JobsPage() {
  const [selectedId, setSelectedId] = useState<Id<"jobs"> | null>(null);
  const [searchText, setSearchText] = useState<string>("");
  const debouncedSearchText = useDebounce(searchText, 500);

  const addJob = useAction(api.jobs.add);

  const totalCount = useQuery(api.jobs.getJobsCount, { search: debouncedSearchText }) as number | undefined;
  const { results, status } = usePaginatedQuery(
    api.jobs.listPaginated,
    { search: debouncedSearchText },
    { initialNumItems: 50 }
  );

  const handleSearch = (value: string) => {
    setSearchText(value);
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
                <span>Showing {results.length} of {totalCount} jobs</span>
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
            
            <Button onClick={handleAddJob} size="sm">
              <Plus className="h-4 w-4" />
              Add Job
            </Button>
          </div>
        </div>

        <JobsTable
          data={results}
          isLoading={status === "LoadingFirstPage"}
          onRowClick={setSelectedId}
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

function JobDialog({ id, onClose }: { id: Id<"jobs">; onClose: () => void }) {
  const job = useQuery(api.jobs.get, { jobId: id  }) 

  const profile = useQuery(api.jobs.getProfile, { jobId: id })
  const sourceData = useQuery(api.jobs.getSourceData, { jobId: id  });
  const [open, setOpen] = useState(true);
  
  const close = () => { 
    setOpen(false); 
    onClose(); 
  };
  
  const initials = getInitials(job?.title);


  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) close(); }}>
      <DialogContent className="h-[85vh] overflow-hidden flex flex-col w-full max-w-[calc(100%-2rem)] sm:!max-w-[95vw] xl:!max-w-[1200px]">
        <DialogHeader className="border-b">
          <div className="flex items-center justify-between p-2">
            <div className="flex items-center gap-3">
              <Avatar className="size-10">
                <AvatarFallback className="text-[11px]">{initials || "?"}</AvatarFallback>
              </Avatar>
              <DialogTitle className="text-base font-semibold leading-none">{job?.title}</DialogTitle>
            </div>
            <div className="flex items-center gap-3 text-xs">
              {job?._creationTime && <div>{new Date(job._creationTime).toLocaleDateString()}</div>}
              <div className="flex items-center gap-2"><span className="inline-block size-2 rounded-full bg-emerald-500" />Processed</div>
            </div>
          </div>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <Tabs defaultValue="matches" className="flex-1 flex flex-col min-h-0">
            <TabsList>
              <TabsTrigger value="matches">Matches</TabsTrigger>
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="raw">SourceData</TabsTrigger>
            </TabsList>
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
                      <th className="text-left p-2">Candidate</th>
                      <th className="text-left p-2">% Score</th>
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
              {profile ? (
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
                  {profile?.summary && (
                    <div className="space-y-2">
                      <div className="font-medium">Summary</div>
                      <p className="whitespace-pre-wrap">{profile.summary}</p>
                    </div>
                  )}
                  {Array.isArray(profile?.workTasks) && profile.workTasks.length > 0 && (
                    <div className="space-y-2">
                      <div className="font-medium">Responsibilities</div>
                      <ul className="list-disc pl-5 space-y-1">
                        {profile.workTasks.map((r: string, i: number) => (
                          <li key={i} className="whitespace-pre-wrap">{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {Array.isArray(profile?.technicalSkills) && profile.technicalSkills.length > 0 && (
                    <div className="space-y-2">
                      <div className="font-medium">Technical Skills</div>
                      <ul className="list-disc pl-5 space-y-1">
                        {profile.technicalSkills.map((skill: { name: string; score: number }, i: number) => (
                           <Badge key={i} variant="outline" className="px-2 py-1">{skill?.name}{typeof skill?.score === "number" ? ` (${skill.score})` : ""}</Badge>  
                        ))}
                      </ul>
                    </div>
                  )}
                  {Array.isArray(profile?.softSkills) && profile.softSkills.length > 0 && (
                    <div className="space-y-2">
                      <div className="font-medium">Soft Skills</div>
                      <div className="flex flex-wrap gap-2">
                        {profile.softSkills.map((skill: { name: string; score: number }, i: number) => (
                          <Badge key={i} variant="outline" className="px-2 py-1">{skill?.name}{typeof skill?.score === "number" ? ` (${skill.score})` : ""}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {Array.isArray(profile?.education) && profile.education.length > 0 && (
                    <div className="space-y-2">
                      <div className="font-medium">Education</div>
                      <ul className="list-disc pl-5 space-y-1">
                        {profile.education.map((education: string, i: number) => (
                          <li key={i} className="whitespace-pre-wrap">{education}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                     {Array.isArray(profile?.aspirations) && profile.aspirations.length > 0 && (
                    <div className="space-y-2">
                      <div className="font-medium">Aspirations</div>
                      <ul className="list-disc pl-5 space-y-1">
                        {profile.aspirations.map((aspiration: string, i: number) => (
                          <li key={i} className="whitespace-pre-wrap">{aspiration}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {Array.isArray(profile?.preferences) && profile.preferences.length > 0 && (
                    <div className="space-y-2">
                      <div className="font-medium">Preferences</div>
                      <ul className="list-disc pl-5 space-y-1">
                        {profile.preferences.map((preference: string, i: number) => (
                          <li key={i} className="whitespace-pre-wrap">{preference}</li>
                        ))}
                      </ul>
                    </div>
                  )}

               
                  {!profile?.summary && (!profile?.technicalSkills || profile.technicalSkills.length === 0) && (!profile?.softSkills || profile.softSkills.length === 0) && (
                    <div className="text-sm text-neutral-400">No profile yet</div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-neutral-400">No profile yet</div>
              )}
            </TabsContent>
            <TabsContent value="raw" className="overflow-y-auto p-3">
              {sourceData ? (
                <div className="space-y-2 text-sm">
                  <div className="font-medium">Raw Data</div>
                  <pre className=" rounded p-3 overflow-x-auto text-xs">
                    {JSON.stringify(sourceData, null, 2)}
                  </pre>
                </div>
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
