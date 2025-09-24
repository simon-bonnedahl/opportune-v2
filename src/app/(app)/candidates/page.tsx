"use client";

import { useState } from "react";
import { useQuery, useAction, usePaginatedQuery } from "convex/react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { CandidatesTable } from "@/components/candidates/candidates-table";
import { ProfileInfoTooltip } from "@/components/ui/profile-info-tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useDebounce } from "@/hooks/use-debounce";
import { useProgressToast } from "@/hooks/use-progress-toast";
import { toast } from "sonner";
import { Plus, Info, MoreVertical, RefreshCw, UserCog, Brain, Link } from "lucide-react";
import { api, Id } from "@/lib/convex";
import usePresence from "@convex-dev/presence/react";
import FacePile from "@convex-dev/presence/facepile";
import Image from "next/image";

export default function CandidatesPage() {
  const [selectedId, setSelectedId] = useState<Id<"candidates"> | null>(null);
  const { showProgressToast } = useProgressToast();
  const [search, setSearch] = useState<string>("");
  const debouncedSearch = useDebounce(search, 500);

  const addCandidate = useAction(api.candidates.add);


  const totalCount = useQuery(api.candidates.getCandidatesCount, { search: debouncedSearch })
  const { results, status } = usePaginatedQuery(
    api.candidates.listPaginated,
    { search: debouncedSearch },
    { initialNumItems: 50 }
  )



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
              value={search}
              onChange={(e) => setSearch(e.target.value)}
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
        <CandidateDialog id={selectedId} onClose={() => setSelectedId(null)} showProgressToast={showProgressToast} />
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

function CandidateDialog({ id, onClose, showProgressToast }: { id: Id<"candidates">; onClose: () => void; showProgressToast: (taskId: Id<"tasks">, title: string) => void }) {
  const profile = useQuery(api.candidates.getProfile, { candidateId: id })
  const sourceData = useQuery(api.candidates.getSourceData, { candidateId: id })
  const candidate = useQuery(api.candidates.get, { candidateId: id })
  const processingStatus = useQuery(api.candidates.getProcessingStatus, { candidateId: id })
  const [open, setOpen] = useState(true);
  const [isReimporting, setIsReimporting] = useState(false);
  const [isRebuilding, setIsRebuilding] = useState(false);
  const [isReembedding, setIsReembedding] = useState(false);
  const addCandidate = useAction(api.candidates.add);
  const rebuildProfile = useAction(api.candidates.rebuildProfile);
  const reembedProfile = useAction(api.candidates.reembedProfile);

  function ProcessingStatusPill() {
    const getStatusColor = (status: string) => {
      switch (status) {
        case "running": return "bg-blue-500 animate-pulse";
        case "queued": return "bg-yellow-500";
        case "succeeded": return "bg-emerald-500";
        case "failed": return "bg-red-500";
        case "canceled": return "bg-gray-500";
        case "none": return "bg-gray-300";
        default: return "bg-gray-400";
      }
    };

    const getStatusLabel = (status: string) => {
      switch (status) {
        case "running": return "Running";
        case "queued": return "Queued";
        case "succeeded": return "Completed";
        case "failed": return "Failed";
        case "canceled": return "Canceled";
        case "none": return "None";
        default: return "Unknown";
      }
    };

    return (
      <div className="inline-flex items-center gap-2 text-xs">
        <span className={`inline-block h-2 w-2 rounded-full ${getStatusColor(processingStatus?.status ?? "unknown")}`} />
        <span>{getStatusLabel(processingStatus?.status ?? "unknown")}</span>
        {processingStatus?.status === "running" && processingStatus?.progress > 0 && (
          <span className="text-muted-foreground">({processingStatus?.progress}%)</span>
        )}
      </div>
    );
  }

  const close = () => {
    setOpen(false);
    onClose();
  };

  const handleReimport = async () => {
    if (!candidate?.teamtailorId) {
      toast.error("No TeamTailor ID found for this candidate");
      return;
    }

    setIsReimporting(true);
    try {
      const result = await addCandidate({ teamtailorId: candidate.teamtailorId });
      if (result?.taskId) {
        showProgressToast(result.taskId, "Re-importing Candidate");
      }
    } catch (error) {
      console.error("Failed to re-import candidate:", error);
      toast.error("Failed to start candidate re-import. Please try again.");
    } finally {
      setIsReimporting(false);
    }
  };

  const handleRebuildProfile = async () => {
    setIsRebuilding(true);
    try {
      const result = await rebuildProfile({ candidateId: id });
      if (result?.taskId) {
        showProgressToast(result.taskId, "Rebuilding Candidate Profile");
      }
    } catch (error) {
      console.error("Failed to rebuild profile:", error);
      toast.error("Failed to rebuild profile");
    } finally {
      setIsRebuilding(false);
    }
  };

  const handleReembedProfile = async () => {
    setIsReembedding(true);
    try {
      const result = await reembedProfile({ candidateId: id });
      if (result?.taskId) {
        showProgressToast(result.taskId, "Re-embedding Candidate Profile");
      }
    } catch (error) {
      console.error("Failed to re-embed profile:", error);
      toast.error("Failed to re-embed profile");
    } finally {
      setIsReembedding(false);
    }
  };

  const initials = getInitials(candidate?.name);




  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) close(); }}>
      <DialogContent className="h-[85vh] overflow-hidden flex flex-col w-full max-w-[calc(100%-2rem)] sm:!max-w-[95vw] xl:!max-w-[1200px]">
        <DialogHeader className="border-b">
          <div className="flex items-center justify-between p-2">
            <div className="flex items-center gap-3">
              <Avatar className="size-10">
                <AvatarFallback className="text-sm">{initials || "?"}</AvatarFallback>
              </Avatar>
              <DialogTitle className="text-base font-semibold leading-none">{candidate?.name}</DialogTitle>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-3 text-xs">
                {candidate?._creationTime && <div>{new Date(candidate._creationTime).toLocaleDateString()}</div>}
                <ProcessingStatusPill />
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={handleReimport}
                    disabled={isReimporting || !candidate?.teamtailorId}
                    className="cursor-pointer"
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${isReimporting ? 'animate-spin' : ''}`} />
                    {isReimporting ? 'Re-importing...' : 'Re-import'}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleRebuildProfile}
                    disabled={isRebuilding}
                    className="cursor-pointer"
                  >
                    <UserCog className={`h-4 w-4 mr-2 ${isRebuilding ? 'animate-spin' : ''}`} />
                    {isRebuilding ? 'Rebuilding...' : 'Rebuild Profile'}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleReembedProfile}
                    disabled={isReembedding || !profile}
                    className="cursor-pointer"
                  >
                    <Brain className={`h-4 w-4 mr-2 ${isReembedding ? 'animate-spin' : ''}`} />
                    {isReembedding ? 'Re-embedding...' : 'Re-embed Profile'}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <Tabs defaultValue="matches" className="flex-1 flex flex-col min-h-0">
            <TabsList>
              <TabsTrigger value="matches">
                Matches
              </TabsTrigger>
              <TabsTrigger value="profile">
                Profile
              </TabsTrigger>
              <TabsTrigger value="sourcedata">
                Source Data
              </TabsTrigger>
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
            </TabsContent>
            <TabsContent value="profile" className="overflow-y-auto p-3 relative">
              {candidate ? (
                <div className="space-y-6 text-sm">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Profile</h3>
                    <ProfileInfoTooltip
                      modelId={profile?.metadata?.modelId}
                      confidence={profile?.metadata?.confidence}
                      updatedAt={profile?.updatedAt}
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
                        {profile.education.map((education: string, i: number) => (
                          <li key={i} className="space-y-0.5">
                            <div className="font-medium">{education || "Education"}</div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {Array.isArray(profile?.technicalSkills) && profile.technicalSkills.length > 0 && (
                    <div className="space-y-2">
                      <div className="font-medium">Technical Skills</div>
                      <div className="flex flex-wrap gap-2">
                        {profile.technicalSkills.map((skill, i: number) => (
                          <Badge key={i} variant="outline" className="px-2 py-1">
                            {skill?.name}{typeof skill?.score === "number" ? ` (${skill.score})` : ""}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {Array.isArray(profile?.softSkills) && profile.softSkills.length > 0 && (
                    <div className="space-y-2">
                      <div className="font-medium">Soft Skills</div>
                      <div className="flex flex-wrap gap-2">
                        {profile.softSkills.map((skill, i: number) => (
                          <Badge key={i} variant="outline" className="px-2 py-1">
                            {skill?.name}{typeof skill?.score === "number" ? ` (${skill.score})` : ""}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {Array.isArray(profile?.workExperience) && profile.workExperience.length > 0 && (
                    <div className="space-y-2">
                      <div className="font-medium">Work Experience</div>
                      <ul className="space-y-3 list-disc pl-5">
                        {profile.workExperience.map((workExperience: string, i: number) => (
                          <li key={i} className="space-y-1">
                            <div className="font-medium">{workExperience || "Work Experience"}</div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {Array.isArray(profile?.preferences) && profile.preferences.length > 0 && (
                    <div className="space-y-2">
                      <div className="font-medium">Preferences</div>
                      <ul className="space-y-2 list-disc pl-5">
                        {profile.preferences.map((preference: string, i: number) => (
                          <li key={i} className="space-y-1">
                            <div className="font-medium">{preference || "Preference"}</div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {Array.isArray(profile?.aspirations) && profile.aspirations.length > 0 && (
                    <div className="space-y-2">
                      <div className="font-medium">Aspirations</div>
                      <ul className="space-y-2 list-disc pl-5">
                        {profile.aspirations.map((aspiration: string, i: number) => (
                          <li key={i} className="space-y-1">
                            <div className="font-medium">{aspiration || "Aspiration"}</div>
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
            <TabsContent value="sourcedata" className="overflow-y-auto p-3">
              <div className="space-y-6 text-sm">
                {/* Assessment Section */}
                {sourceData?.assessment ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-base">Teamtailor Assessment</div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {sourceData.assessment.rating && (
                          <div className="flex items-center gap-1">
                            <div className="flex items-center gap-0.5">
                              {[...Array(5)].map((_, i) => (
                                <span
                                  key={i}
                                  className={`text-lg ${i < (sourceData.assessment?.rating ?? 0)
                                    ? "text-yellow-400"
                                    : "text-gray-300"
                                  }`}
                                >
                                  ★
                                </span>
                              ))}
                              <span className="ml-1 text-md">({sourceData.assessment.rating}/5)</span>
                            </div>
                          </div>
                        )}
                        {sourceData.assessment.createdAt && (
                          <div className="text-md">
                            {new Date(sourceData.assessment.createdAt).toLocaleDateString('sv-SE', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })}
                          </div>
                        )}
                        <Button
                          className="hover:cursor-pointer hover:scale-105 transition-all duration-300"
                          variant="link"
                          size="icon"
                          onClick={() => window.open(process.env.NEXT_PUBLIC_TEAMTAILOR_BASE_URL + "/candidates/" + candidate?.teamtailorId, "_blank")}
                        >
                          <Image
                            src="/images/teamtailor_logo.png"
                            alt="Teamtailor"
                            width={24}
                            height={24}
                            className="size-6 rounded-full"
                          />
                        </Button>
                      </div>
                    </div>

                    {sourceData.assessment.comment && sourceData.assessment.comment.trim().length > 0 ? (
                      <div className="space-y-3">
                        <div className="bg-muted/30 rounded-lg p-4">
                          <p className="whitespace-pre-wrap leading-relaxed">{sourceData.assessment.comment}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-neutral-400">No assessment details available</div>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-neutral-400">No assessment available</div>
                )}

                 {/* Hubert Q&A Section */}
                 {sourceData?.hubertAnswers && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-base">Hubert</div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {sourceData.hubertUrl && (
                          <Button
                            className="hover:cursor-pointer hover:scale-105 transition-all duration-300"
                            variant="link"
                            size="icon"
                            onClick={() => window.open(sourceData.hubertUrl, "_blank")}
                          >
                            <Image
                              src="/images/hubert_logo.png"
                              alt="Hubert"
                              width={24}
                              height={24}
                              className="size-6 rounded-full"
                            />
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="bg-muted/30 rounded-lg p-4">
                      <p className="whitespace-pre-wrap">{sourceData.hubertAnswers}</p>
                    </div>
                  </div>
                )}


                {/* Resume Summary Section */}
                {sourceData?.resumeSummary && (
                  <div className="space-y-2">
                    <div className="font-medium text-base">Resume Summary</div>
                    <div className="bg-muted/30 rounded-lg p-4">
                      <p className="whitespace-pre-wrap">{sourceData.resumeSummary}</p>
                    </div>
                  </div>
                )}

                {/* LinkedIn Summary Section */}
                {sourceData?.linkedinSummary && (
                  <div className="space-y-2">
                    <div className="font-medium text-base">LinkedIn Summary</div>
                    <div className="bg-muted/30 rounded-lg p-4">
                      <p className="whitespace-pre-wrap">{sourceData.linkedinSummary}</p>
                    </div>
                  </div>
                )}

               
               


              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}

