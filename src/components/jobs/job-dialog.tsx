"use client";

import { useState } from "react";
import { useQuery, useAction } from "convex/react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProfileInfoTooltip } from "@/components/ui/profile-info-tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useProgressToast } from "@/hooks/use-progress-toast";
import { toast } from "sonner";
import { RefreshCw, UserCog, Brain, Info, MoreHorizontal } from "lucide-react";
import { api, Id } from "@/lib/convex";
import Image from "next/image";

function getInitials(text?: string) {
  if (!text) return "?";
  const parts = text.split(" ").filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

interface JobDialogProps {
  id: Id<"jobs">;
  onClose: () => void;
  showProgressToast: (taskId: Id<"tasks">, title: string) => void;
}

export function JobDialog({ id, onClose, showProgressToast }: JobDialogProps) {
  const job = useQuery(api.jobs.get, { jobId: id  })
  const profile = useQuery(api.jobs.getProfile, { jobId: id })
  const sourceData = useQuery(api.jobs.getSourceData, { jobId: id  });
  const processingStatus = useQuery(api.jobs.getProcessingStatus, { jobId: id });
  const [open, setOpen] = useState(true);
  const [isReimporting, setIsReimporting] = useState(false);
  const [isRebuilding, setIsRebuilding] = useState(false);
  const [isReembedding, setIsReembedding] = useState(false);
  
  const addJob = useAction(api.jobs.add);
  const rebuildProfile = useAction(api.jobs.rebuildProfile);
  const reembedProfile = useAction(api.jobs.reembedProfile);

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
    if (!job?.teamtailorId) {
      toast.error("No TeamTailor ID found for this job");
      return;
    }

    setIsReimporting(true);
    try {
      const result = await addJob({ teamtailorId: job.teamtailorId });
      if (result?.taskId) {
        showProgressToast(result.taskId, "Re-importing Job");
      }
    } catch (error) {
      console.error("Failed to re-import job:", error);
      toast.error("Failed to start job re-import. Please try again.");
    } finally {
      setIsReimporting(false);
    }
  };

  const handleRebuildProfile = async () => {
    setIsRebuilding(true);
    try {
      const result = await rebuildProfile({ jobId: id });
      if (result?.taskId) {
        showProgressToast(result.taskId, "Rebuilding Job Profile");
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
      const result = await reembedProfile({ jobId: id });
      if (result?.taskId) {
        showProgressToast(result.taskId, "Re-embedding Job Profile");
      }
    } catch (error) {
      console.error("Failed to re-embed profile:", error);
      toast.error("Failed to re-embed profile");
    } finally {
      setIsReembedding(false);
    }
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
              <DialogTitle className="text-base font-semibold leading-none">{job?.title ?? job?.teamtailorTitle}</DialogTitle>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-3 text-xs">
                {job?._creationTime && <div>{new Date(job._creationTime).toLocaleDateString()}</div>}
                <ProcessingStatusPill />
              </div>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem 
                    onClick={handleReimport}
                    disabled={isReimporting || !job?.teamtailorId}
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
              <TabsTrigger value="matches">Matches</TabsTrigger>
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="sourcedata">Source Data</TabsTrigger>
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
                    <tr>
                      <td colSpan={6} className="text-center p-4 text-muted-foreground">
                        No matches found
                      </td>
                    </tr>
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
                      updatedAt={profile?.updatedAt}
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
                      <div className="flex flex-wrap gap-2">
                        {profile.technicalSkills.map((skill: { name: string; score: number }, i: number) => (
                           <Badge key={i} variant="outline" className="px-2 py-1">{skill?.name}{typeof skill?.score === "number" ? ` (${skill.score})` : ""}</Badge>  
                        ))}
                      </div>
                    </div>
                  )}
                  {Array.isArray(profile?.softSkills) && profile.softSkills.length > 0 && (
                    <div className="space-y-2">
                      <div className="font-medium">Soft Skills</div>
                      <div className="flex flex-wrap gap-2">
                        {profile.softSkills.map((skill, i: number) => (
                          <Badge key={i} variant="outline" className="px-2 py-1">{skill}</Badge>
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
            <TabsContent value="sourcedata" className="overflow-y-auto p-3">
              <div className="space-y-6 text-sm">
                {/* TeamTailor Body Section */}
                {sourceData?.teamtailorBody ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-base">TeamTailor Body</div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <Button
                          className="hover:cursor-pointer hover:scale-105 transition-all duration-300"
                          variant="link"
                          size="icon"
                          onClick={() => window.open(process.env.NEXT_PUBLIC_TEAMTAILOR_BASE_URL + "/jobs/" + job?.teamtailorId, "_blank")}
                        >
                          <Image
                            src="/images/teamtailor_logo.png"
                            alt="Teamtailor"
                            width={100}
                            height={100}
                            className="size-6 rounded-full"
                          />
                        </Button>
                      </div>
                    </div>
                    <div className="bg-muted/30 rounded-lg p-4">
                      <div className="whitespace-pre-wrap">
                        {typeof sourceData.teamtailorBody === 'string' 
                          ? sourceData.teamtailorBody 
                          : JSON.stringify(sourceData.teamtailorBody, null, 2)
                        }
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-neutral-400">No TeamTailor body data available</div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
