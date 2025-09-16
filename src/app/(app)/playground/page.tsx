/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
"use client";

import { useMemo, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
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

export default function PlaygroundPage() {
  const [selectedCandidate, setSelectedCandidate] = useState<Doc<"candidates"> | null>(null);
  const [selectedJob, setSelectedJob] = useState<Doc<"jobs"> | null>(null);
  const [selectedScoreCard, setSelectedScoreCard] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>("gpt-5");
  const [openModelDialog, setOpenModelDialog] = useState<boolean>(false);

  const [selectedScoringGuideline, setSelectedScoringGuideline] = useState<Doc<"scoringGuidelines"> | null>(null);


  // Available models grouped by company
  const availableModels = [
    {
      company: "OpenAI",
      models: [
        { value: "gpt-5", label: "GPT-5" },
        { value: "gpt-4o", label: "GPT-4o" },
      ]
    },
    {
      company: "Google",
      models: [
        { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
      ]
    },
    {
      company: "Anthropic",
      models: [
        { value: "claude-4-sonnet-20240229", label: "Claude 4 Sonnet" },
      ]
    },
  ];

  // Get current model label
  const getCurrentModelLabel = () => {
    for (const group of availableModels) {
      const model = group.models.find(m => m.value === selectedModel);
      if (model) return model.label;
    }
    return "Select Model";
  };


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
  const enqueueMatch = useAction(api.matches.enqueueMatch);

  const handleCreateMatch = async () => {
    if (!selectedCandidate || !selectedJob || !matchScores || !selectedScoringGuideline) return;

    try {
      await enqueueMatch({
        candidateId: selectedCandidate._id,
        jobId: selectedJob._id,
        model: selectedModel,
        scoringGuidelineId: selectedScoringGuideline._id,
      });
    } catch (error) {
      console.error("Failed to create match:", error);
    }
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
                          <TableHead>Date</TableHead>
                          <TableHead>Explanation</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previousMatches.map((match) => (
                          <TableRow key={match._id}>
                            <TableCell className="font-medium">{match.model}</TableCell>
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
                            <TableCell>
                              {new Date(match.updatedAt).toLocaleDateString()}
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
            <div className="space-y-2  w-full">
              <Label>Model</Label>
              <Dialog open={openModelDialog} onOpenChange={setOpenModelDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    {getCurrentModelLabel()}
                  </Button>
                </DialogTrigger>
                <DialogContent className="p-0 overflow-hidden">
                  <DialogTitle className="sr-only">Select Model</DialogTitle>
                  <Command>
                    <CommandInput placeholder="Search models..." />
                    <CommandList>
                      <CommandEmpty>No models found.</CommandEmpty>
                      {availableModels.map((group) => (
                        <CommandGroup key={group.company} heading={group.company}>
                          {group.models.map((model) => (
                            <CommandItem
                              key={model.value}
                              value={model.value}
                              onSelect={() => {
                                setSelectedModel(model.value);
                                setOpenModelDialog(false);
                              }}
                              className="py-3 h-12"
                            >
                              <div className="flex items-center justify-between w-full">
                                <span>{model.label}</span>
                                {selectedModel === model.value && (
                                  <Badge variant="outline" className="text-xs">
                                    Selected
                                  </Badge>
                                )}
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      ))}
                    </CommandList>
                  </Command>
                </DialogContent>
              </Dialog>
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

          {/* Create Match Button */}
          <Button
            onClick={handleCreateMatch}
            disabled={!selectedCandidate || !selectedJob || !matchScores || !selectedScoringGuideline}
            className="w-full"
          >
            Create New Match
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


