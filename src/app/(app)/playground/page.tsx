/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
"use client";

import { useMemo, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadialProgress } from "@/components/ui/radial-progress";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Doc, Id } from "@/lib/convex";
import { CandidateSearch } from "@/components/playground/candidate-search";
import { JobSearch } from "@/components/playground/job-search";
import { Input } from "@/components/ui/input";
import { Icons } from "@/components/icons";
import { models } from "@/config/models";
import { formatDuration, timeAgo } from "@/lib/format";
import {
  Context,
  ContextTrigger,
  ContextContent,
  ContextContentHeader,
  ContextContentBody,
  ContextContentFooter,
  ContextInputUsage,
  ContextOutputUsage,
  ContextReasoningUsage,
  ContextCacheUsage
} from "@/components/ai-elements/context";
import { getProviderLogo } from "@/lib/provider-logos";
import Image from "next/image";
import { Task, TaskContent, TaskItem, TaskTrigger } from "@/components/ai-elements/task";

export default function PlaygroundPage() {
  const [selectedCandidate, setSelectedCandidate] = useState<Doc<"candidates"> | null>(null);
  const [selectedJob, setSelectedJob] = useState<Doc<"jobs"> | null>(null);
  const [selectedScoreCard, setSelectedScoreCard] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>("gpt-5");
  const [currentTaskId, setCurrentTaskId] = useState<Id<"tasks"> | null>(null);

  const [selectedScoringGuideline, setSelectedScoringGuideline] = useState<Doc<"scoringGuidelines"> | null>(null);

  // Get available models from config
  const availableModels = models.filter(model => model.enabled).map(model => model.id);



  // Fetch match scores when both candidate and job are selected
  const matchScores = useQuery(
    api.matches.getMatchScores,
    selectedCandidate && selectedJob
      ? {
        candidateId: selectedCandidate._id,
        jobId: selectedJob._id,
      }
      : "skip"
  );

  // Fetch section details when a score card is selected
  const sectionDetails = useQuery(
    api.matches.getSectionDetails,
    selectedCandidate && selectedJob && selectedScoreCard
      ? {
        candidateId: selectedCandidate._id,
        jobId: selectedJob._id,
        section: selectedScoreCard as any,
      }
      : "skip"
  );

  const scoringGuidelines = useQuery(api.scoringGuidelines.list);

  // Fetch previous matches
  const previousMatches = useQuery(
    api.matches.getPreviousMatches,
    selectedCandidate && selectedJob
      ? {
        candidateId: selectedCandidate._id,
        jobId: selectedJob._id,
      }
      : "skip"
  );

  // Create new match mutation
  const runTask = useAction(api.tasks.runTask);

  // Get task status when we have a current task
  const currentTask = useQuery(
    api.tasks.get,
    currentTaskId ? { taskId: currentTaskId } : "skip"
  );

  const handleCreateMatch = async () => {
    if (!selectedCandidate || !selectedJob || !matchScores || !selectedScoringGuideline) return;

    // Clear any previous task
    setCurrentTaskId(null);

    try {
      const result = await runTask({
        taskType: "match",
        triggeredBy: "user",
        args: {
          candidateId: selectedCandidate._id,
          jobId: selectedJob._id,
          model: selectedModel,
          scoringGuidelineId: selectedScoringGuideline._id,
        },
      });

      if (result?.data?.taskId) {
        setCurrentTaskId(result.data.taskId);
      }
    } catch (error) {
      console.error("Failed to create match:", error);
    }
  };

  const handleClearTask = () => {
    setCurrentTaskId(null);
  };



  return (
    <div className="flex" style={{ height: 'calc(100vh - 4rem)' }}>
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Match Scores Display */}
            {selectedCandidate && selectedJob && matchScores && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <ScoreCard
                    label="Overall Score"
                    value={matchScores.averageScore}
                    highlight={true}
                  />
                  <ScoreCard
                    label="Summary"
                    value={matchScores.summaryScore}
                    isSelected={selectedScoreCard === "summary"}
                    onClick={() => setSelectedScoreCard(selectedScoreCard === "summary" ? null : "summary")}
                  />
                  <ScoreCard
                    label="Technical Skills"
                    value={matchScores.technicalSkillsScore}
                    isSelected={selectedScoreCard === "technical_skills"}
                    onClick={() => setSelectedScoreCard(selectedScoreCard === "technical_skills" ? null : "technical_skills")}
                  />
                  <ScoreCard
                    label="Soft Skills"
                    value={matchScores.softSkillsScore}
                    isSelected={selectedScoreCard === "soft_skills"}
                    onClick={() => setSelectedScoreCard(selectedScoreCard === "soft_skills" ? null : "soft_skills")}
                  />
                  <ScoreCard
                    label="Education"
                    value={matchScores.educationScore}
                    isSelected={selectedScoreCard === "education"}
                    onClick={() => setSelectedScoreCard(selectedScoreCard === "education" ? null : "education")}
                  />
                  <ScoreCard
                    label="Work Experience"
                    value={matchScores.workTasksScore}
                    isSelected={selectedScoreCard === "work_tasks"}
                    onClick={() => setSelectedScoreCard(selectedScoreCard === "work_tasks" ? null : "work_tasks")}
                  />
                  <ScoreCard
                    label="Preferences"
                    value={matchScores.preferencesScore}
                    isSelected={selectedScoreCard === "preferences"}
                    onClick={() => setSelectedScoreCard(selectedScoreCard === "preferences" ? null : "preferences")}
                  />
                  <ScoreCard
                    label="Aspirations"
                    value={matchScores.aspirationsScore}
                    isSelected={selectedScoreCard === "aspirations"}
                    onClick={() => setSelectedScoreCard(selectedScoreCard === "aspirations" ? null : "aspirations")}
                  />
                </div>
              </div>
            )}

            {/* Section Details Display */}
            {selectedScoreCard && sectionDetails && (
              <div className="space-y-3">
                <div className="grid md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Job</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="prose prose-xs max-w-none">
                        {sectionDetails.isArray ? (
                          <div className="whitespace-pre-wrap">
                            {(sectionDetails.job as string[]).map((item: string, index: number) => (
                              <div key={index} className="flex items-start gap-1.5 mb-0.5">
                                <span className="text-primary mt-0.5 text-xs">•</span>
                                <span className="text-sm">{item}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap text-sm">{sectionDetails.job as string}</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Candidate</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="prose prose-xs max-w-none">
                        {sectionDetails.isArray ? (
                          <div className="whitespace-pre-wrap">
                            {(sectionDetails.candidate as string[]).map((item: string, index: number) => (
                              <div key={index} className="flex items-start gap-1.5 mb-0.5">
                                <span className="text-primary mt-0.5 text-xs">•</span>
                                <span className="text-sm">{item}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap text-sm">{sectionDetails.candidate as string}</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {/* Previous Matches Table */}
            {selectedCandidate && selectedJob && previousMatches && previousMatches.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-xl font-semibold">Previous Matches</h3>
                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Model</TableHead>
                          <TableHead>Score</TableHead>
                          <TableHead>Guidelines</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Explanation</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previousMatches.map((match) => (
                          <TableRow key={match._id}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                {match.metadata?.totalUsage ? (
                                  <Context
                                    usedTokens={match.metadata.totalUsage.totalTokens}
                                    maxTokens={match.metadata.model === 'gpt-5' ? 200000 : 128000}
                                    usage={match.metadata.totalUsage}
                                    modelId={match.metadata.modelId}
                                  >
                                    <ContextTrigger>
                                      <Image
                                        src={getProviderLogo(match.metadata?.provider || "OpenAI").src}
                                        alt={getProviderLogo(match.metadata?.provider || "OpenAI").alt}
                                        width={20}
                                        height={20}
                                        className="cursor-pointer hover:opacity-80 transition-opacity rounded-full"
                                      />
                                    </ContextTrigger>
                                    <ContextContent>
                                      <ContextContentHeader />
                                      <ContextContentBody>
                                        <div className="space-y-2">
                                          <ContextInputUsage />
                                          <ContextOutputUsage />
                                          <ContextReasoningUsage />
                                          <ContextCacheUsage />
                                        </div>
                                      </ContextContentBody>
                                      <ContextContentFooter />
                                    </ContextContent>
                                  </Context>
                                ) : (
                                  <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center">
                                    <span className="text-xs text-muted-foreground">?</span>
                                  </div>
                                )}
                                <span>{match.model}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Progress
                                  value={match.score * 100}
                                  className="h-2 flex-1"
                                />
                                <div className="text-sm font-medium min-w-[3rem] text-right">
                                  {(match.score * 100).toFixed(1)}%
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="font-medium">
                              {scoringGuidelines?.find((scoringGuideline) => scoringGuideline._id === match.scoringGuidelineId)?.name || "No guideline"}
                            </TableCell>
                            <TableCell>
                              {timeAgo(match._creationTime)}
                            </TableCell>
                            <TableCell className="max-w-xs">
                              <div className="break-words whitespace-pre-wrap">
                                {match.explanation || "No explanation"}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Right Sidebar */}
      <div className="w-96 border-l bg-muted/30 flex flex-col" style={{ height: 'calc(100vh - 4rem)' }}>
        <div className="p-6 flex flex-col h-full justify-between">

          <div className="space-y-4">
            {/* Job Selection */}
            <div className="space-y-2">
              <Label>Job</Label>
              <JobSearch onSelect={setSelectedJob}>
                <Button variant="outline" className="w-full justify-start">
                  {selectedJob?.title ?? "Select Job"}
                </Button>
              </JobSearch>
            </div>

            {/* Candidate Selection */}
            <div className="space-y-2">
              <Label>Candidate</Label>
              <CandidateSearch onSelect={setSelectedCandidate}>
                <Button variant="outline" className="w-full justify-start">
                  {selectedCandidate?.name ?? "Select Candidate"}
                </Button>
              </CandidateSearch>
            </div>

            {/* Model Selection */}
            <div className="space-y-2 w-full">
              <Label>Model</Label>
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select Model" />
                </SelectTrigger>
                <SelectContent>
                  {availableModels && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">OpenAI</div>
                      {availableModels.filter(model =>
                        model === "gpt-5" || model === "gpt-5-mini" || model === "gpt-5-nano" || model === "gpt-4o"
                      ).map((model) => {
                        const modelInfo = models.find(m => m.id === model);
                        return (
                          <SelectItem key={model} value={model}>
                            {modelInfo?.name || model}
                          </SelectItem>
                        );
                      })}
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Google</div>
                      {availableModels.filter(model =>
                        model.startsWith("gemini")
                      ).map((model) => {
                        const modelInfo = models.find(m => m.id === model);
                        return (
                          <SelectItem key={model} value={model}>
                            {modelInfo?.name || model}
                          </SelectItem>
                        );
                      })}
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Anthropic</div>
                      {availableModels.filter(model =>
                        model.startsWith("claude")
                      ).map((model) => {
                        const modelInfo = models.find(m => m.id === model);
                        return (
                          <SelectItem key={model} value={model}>
                            {modelInfo?.name || model}
                          </SelectItem>
                        );
                      })}
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">xAI</div>
                      {availableModels.filter(model =>
                        model.startsWith("grok")
                      ).map((model) => {
                        const modelInfo = models.find(m => m.id === model);
                        return (
                          <SelectItem key={model} value={model}>
                            {modelInfo?.name || model}
                          </SelectItem>
                        );
                      })}
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Scoring Guidelines */}
            <div className="space-y-2 w-full">
              <Label>Scoring Guidelines</Label>
              <Select onValueChange={(value) => setSelectedScoringGuideline(scoringGuidelines?.find((scoringGuideline) => scoringGuideline._id === value) ?? null)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select Scoring Guidelines" />
                </SelectTrigger>
                <SelectContent>
                  {scoringGuidelines?.map((scoringGuideline) => (
                    <SelectItem key={scoringGuideline._id} value={scoringGuideline._id}>
                      {scoringGuideline.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Selected Scoring Guidelines Content */}
            {selectedScoringGuideline && (
              <div className="space-y-2 w-full">
                <Textarea value={selectedScoringGuideline.text} disabled className="max-h-96 overflow-y-auto resize-none" />
              </div>
            )}

          </div>

         
          {/* Progress Messages */}
					{currentTask && currentTask.progressMessages.length > 0 && (
						<div className="space-y-4">
							<div className="bg-muted/30 rounded-lg p-4 flex flex-col gap-4">
				

								<Task key={currentTask._id} defaultOpen={true}>
									<TaskTrigger  title={currentTask.progressMessages[currentTask.progressMessages.length - 1].message + " • " + currentTask.progress + "%"} status={currentTask.status} />
									<TaskContent>
										{currentTask.progressMessages.map((messages, itemIndex: number) => {
											const currentTimestamp = messages.timestamp;
											const nextTimestamp = currentTask.progressMessages[itemIndex + 1]?.timestamp;
											const duration = itemIndex > 0 && nextTimestamp ? formatDuration(currentTimestamp, nextTimestamp, 1) : null;
											
											return (
												<TaskItem key={itemIndex}>
													{messages.message}
													{duration && ` ${duration}`}
												</TaskItem>
											);
										})}
									</TaskContent>
								</Task>
							</div>
							
						</div>
					)}

          {/* Create Match Button */}
          <Button
            onClick={handleCreateMatch}
            disabled={!selectedCandidate || !selectedJob || !matchScores || !selectedScoringGuideline || (currentTask?.status === "running")}
            className="w-full"
          >
            {currentTask?.status === "running" ? (
              <>
                <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                Creating Match...
              </>
            ) : (
              "Create New Match"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}




function ScoreCard({
  label,
  value,
  highlight,
  isSelected,
  onClick
}: {
  label: string;
  value?: number;
  highlight?: boolean;
  isSelected?: boolean;
  onClick?: () => void;
}) {
  const display = value === undefined ? "-" : `${(value * 100).toFixed(1)}%`;
  const progressValue = value === undefined ? 0 : value * 100;

  // Color coding based on score
  const getProgressColor = (score: number) => {
    if (score >= 0.7) return "text-green-500"; // Green for good scores (70%+)
    if (score >= 0.4) return "text-yellow-500"; // Yellow for moderate scores (40-69%)
    return "text-red-500"; // Red for poor scores (<40%)
  };

  const progressColor = value === undefined ? "text-gray-400" : getProgressColor(value);

  return (
    <Card
      className={`cursor-pointer transition-all hover:shadow-md ${highlight ? "border-primary/60" : ""
        } ${isSelected ? "ring-2 ring-primary" : ""}`}
      onClick={onClick}
    >
      <CardHeader className="pb-2 px-3 pt-3">
        <CardTitle className="text-sm text-neutral-400 font-normal leading-tight">{label}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0 px-3 pb-3">
        <div className="text-lg font-semibold">{display}</div>
      </CardContent>
    </Card>
  );
}

function getInitials(name?: string) {
  if (!name) return "?";
  const parts = name.split(" ").filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}


