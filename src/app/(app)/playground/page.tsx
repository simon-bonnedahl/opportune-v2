"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function PlaygroundPage() {
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [openCandidate, setOpenCandidate] = useState(false);
  const [openJob, setOpenJob] = useState(false);
  const [model, setModel] = useState<string>("gpt-5");
  const [prompt, setPrompt] = useState<string>(
    "You are an expert candidate–job matching engine.\nGiven a structured Candidate Profile and Job Profile, compute a suitability score between 0.0 and 1.0.\n\nReturn STRICT JSON only with fields:\n{\"score\": number, \"explanation\": string}\n\nScoring guidelines:\n- Prioritize hard/mandatory requirements. If a must‑have is missing, cap score at 0.4.\n- Evaluate: skills overlap (names and synonyms), responsibilities alignment, seniority/level, industry/domain, tools/technologies, education/certifications, recency and depth of experience.\n- Penalize outdated or non‑relevant experience and level mismatches.\n- Use the full 0.0–1.0 range; reserve ≥0.8 for strong fits.\n- Keep explanation concise (≤80 words), cite 2–4 strongest signals and any critical gap.\n\nReturn only the JSON object."
  );
  const [temperature, setTemperature] = useState<number>(0.1);

  // Model-specific settings intentionally simplified: only temperature
  function supportsTemperatureForModel(m: string | undefined): boolean {
    if (!m) return true;
    const l = m.toLowerCase();
    const isOpenAI = !l.includes("claude") && !l.includes("gemini") && !l.startsWith("models/") && !l.startsWith("groq/");
    if (!isOpenAI) return true; // Claude/Gemini/Groq support temperature
    if (l.includes("gpt-5")) return false;
    if (l.startsWith("o3") || l.startsWith("o4")) return false;
    return true;
  }
  const temperatureSupported = supportsTemperatureForModel(model);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);

  const candidates = useQuery(api.teamtailor.getCandidates) as any[] | undefined;
  const jobs = useQuery(api.teamtailor.getJobs) as any[] | undefined;

  const sortedCandidates = useMemo(() => {
    const arr = (candidates ?? []).slice();
    arr.sort((a: any, b: any) => ((b?.updatedAt ?? b?._creationTime ?? 0) - (a?.updatedAt ?? a?._creationTime ?? 0)));
    return arr;
  }, [candidates]);

  const sortedJobs = useMemo(() => {
    const arr = (jobs ?? []).slice();
    arr.sort((a: any, b: any) => ((b?.updatedAt ?? b?._creationTime ?? 0) - (a?.updatedAt ?? a?._creationTime ?? 0)));
    return arr;
  }, [jobs]);

  const candidateLabel = useMemo(() => {
    if (!selectedCandidateId) return "Select Candidate";
    const c = (candidates ?? []).find((x: any) => String(x._id) === String(selectedCandidateId));
    return c?.name ?? String(selectedCandidateId);
  }, [selectedCandidateId, candidates]);
  const jobLabel = useMemo(() => {
    if (!selectedJobId) return "Select Job";
    const j = (jobs ?? []).find((x: any) => String(x._id) === String(selectedJobId));
    return j?.rawData?.attributes?.title ?? String(selectedJobId);
  }, [selectedJobId, jobs]);

  const scoring = useQuery(
    api.embeddings.scoreCandidateAgainstJob,
    selectedCandidateId && selectedJobId
      ? ({ candidateId: selectedCandidateId as any, jobId: selectedJobId as any } as any)
      : "skip"
  );

  const candProfileRes = useQuery(
    api.profiles.getProfilesByCandidateIds,
    selectedCandidateId ? { candidateIds: [selectedCandidateId as any] } : { candidateIds: [] as any }
  ) as any[] | undefined;
  const jobProfileRes = useQuery(
    api.profiles.getJobProfilesByJobIds,
    selectedJobId ? { jobIds: [selectedJobId as any] } : { jobIds: [] as any }
  ) as any[] | undefined;
  const candProfile = candProfileRes?.[0];
  const jobProfile = jobProfileRes?.[0];

  const candSourceRes = useQuery(
    api.teamtailor.getSourceDataByCandidateIds,
    selectedCandidateId ? { candidateIds: [selectedCandidateId as any] } : { candidateIds: [] as any }
  ) as any[] | undefined;
  const jobSourceRes = useQuery(
    api.teamtailor.getJobSourceDataByJobIds,
    selectedJobId ? { jobIds: [selectedJobId as any] } : { jobIds: [] as any }
  ) as any[] | undefined;
  const candSource = candSourceRes?.[0];
  const jobSource = jobSourceRes?.[0];

  const currentMatch = useQuery(
    api.matches.getMatchByCandidateAndJob as any,
    selectedCandidateId && selectedJobId
      ? ({ candidateId: selectedCandidateId as any, jobId: selectedJobId as any, model } as any)
      : "skip"
  ) as any | undefined;

  const enqueueTask = useMutation(api.tasks.enqueueTask as any);
  const taskItem = useQuery(
    api.tasks.getItem as any,
    taskId ? ({ taskId } as any) : "skip"
  ) as any | undefined;

  const isTaskActive = !!taskId && (taskItem === undefined || ["pending", "running", "cancelRequested"].includes(String(taskItem?.status)));

  async function onCreateMatch() {
    if (!selectedCandidateId || !selectedJobId) return;
    setIsSubmitting(true);
    try {
      const res = await enqueueTask({
        taskType: "match",
        candidateId: selectedCandidateId as any,
        jobId: selectedJobId as any,
        model: model || undefined,
        prompt: prompt || undefined,
        config: {
          temperature,
        },
        requestedBy: "playground",
      } as any);
      if (res && typeof res.taskId === "string") setTaskId(res.taskId);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      <div className="flex items-center gap-3">
        <Button variant="outline" onClick={() => setOpenCandidate(true)}>{candidateLabel}</Button>
        <span className="text-neutral-500">vs</span>
        <Button variant="outline" onClick={() => setOpenJob(true)}>{jobLabel}</Button>
      </div>

      <Dialog open={openCandidate} onOpenChange={setOpenCandidate}>
        <DialogContent className="p-0 overflow-hidden">
          <DialogTitle className="sr-only">Select Candidate</DialogTitle>
          <Command>
            <CommandInput placeholder="Search candidates..." />
            <CommandList>
              <CommandEmpty>No candidates found.</CommandEmpty>
              <CommandGroup heading="Candidates">
                {sortedCandidates.map((c: any) => (
                  <CommandItem
                    key={String(c._id)}
                    value={c?.name ?? String(c._id)}
                    onSelect={() => { setSelectedCandidateId(String(c._id)); setOpenCandidate(false); }}
                    className="py-3 h-12"
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar className="h-8 w-8">
                          {c?.imageUrl ? (
                            <AvatarImage src={c.imageUrl} alt={c?.name ?? ""} />
                          ) : null}
                          <AvatarFallback className="text-[10px]">{getInitials(c?.name)}</AvatarFallback>
                        </Avatar>
                        <span className="truncate">{c.name}</span>
                      </div>
                      <span className="text-xs text-neutral-500 ml-3">{new Date(c.updatedAt ?? c._creationTime).toLocaleDateString()}</span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>

      <Dialog open={openJob} onOpenChange={setOpenJob}>
        <DialogContent className="p-0 overflow-hidden">
          <DialogTitle className="sr-only">Select Job</DialogTitle>
          <Command>
            <CommandInput placeholder="Search jobs..." />
            <CommandList>
              <CommandEmpty>No jobs found.</CommandEmpty>
              <CommandGroup heading="Jobs">
                {sortedJobs.map((j: any) => {
                  const title = j?.rawData?.attributes?.title ?? String(j._id);
                  return (
                    <CommandItem
                      key={String(j._id)}
                      value={title}
                      onSelect={() => { setSelectedJobId(String(j._id)); setOpenJob(false); }}
                      className="py-3 h-12"
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2 min-w-0">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-[10px]">{getInitials(title)}</AvatarFallback>
                          </Avatar>
                          <span className="truncate">{title}</span>
                        </div>
                        <span className="text-xs text-neutral-500 ml-3">{new Date(j.updatedAt ?? j._creationTime).toLocaleDateString()}</span>
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>

      <div className="space-y-3">
        <div className="text-sm text-neutral-400">Scoring</div>
        {!selectedCandidateId || !selectedJobId ? (
          <div className="text-neutral-400">Select a candidate and a job to see scores</div>
        ) : scoring === undefined ? (
          <div className="text-neutral-400">Loading...</div>
        ) : scoring ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            <ScoreCard label="Final" value={scoring?.finalScore} highlight />
            <ScoreCard label="Vector" value={scoring?.vectorSim} />
            <ScoreCard label="Skills" value={scoring?.skillOverlap} />
            <ScoreCard label="Experience vs Resp" value={scoring?.experienceAlignment} />
            <ScoreCard label="Education vs Req" value={scoring?.educationAlignment} />
            <ScoreCard label="Raw" value={typeof scoring?.rawVectorSim === "number" ? scoring?.rawVectorSim : (typeof scoring?.rawScore === "number" ? scoring?.rawScore : undefined)} />
          </div>
        ) : null}
      </div>

      <div className="space-y-3">
        <div className="text-sm text-neutral-400">Match</div>
        {!selectedCandidateId || !selectedJobId ? (
          <div className="text-neutral-400">Select a candidate and a job to view or create a match</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Current Match</CardTitle>
              </CardHeader>
              <CardContent>
                {currentMatch === undefined ? (
                  <div className="text-neutral-400 text-sm">Loading...</div>
                ) : currentMatch ? (
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="text-2xl font-semibold">{`${(Number(currentMatch.score) * 100).toFixed(1)}%`}</div>
                      {currentMatch?.metadata?.model && (
                        <Badge variant="outline">{currentMatch.metadata.model}</Badge>
                      )}
                    </div>
                    {currentMatch?.metadata?.prompt && (
                      <div>
                        <div className="font-medium mb-1">Prompt</div>
                        <ScrollArea className="h-28 border border-[var(--border)] rounded">
                          <pre className="p-3 text-xs whitespace-pre-wrap">{String(currentMatch.metadata.prompt)}</pre>
                        </ScrollArea>
                      </div>
                    )}
                    {currentMatch?.explanation && (
                      <div>
                        <div className="font-medium mb-1">Explanation</div>
                        <p className="whitespace-pre-wrap">{currentMatch.explanation}</p>
                      </div>
                    )}
                    <div className="text-xs text-neutral-500">Updated {new Date(currentMatch.updatedAt ?? currentMatch._creationTime).toLocaleString()}</div>
                  </div>
                ) : (
                  <div className="text-neutral-400 text-sm">No match stored yet</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Create New Match</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="model">Model</Label>
                  <Select value={model} onValueChange={setModel}>
                    <SelectTrigger id="model" className="w-full">
                      <SelectValue placeholder="Select a model" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>OpenAI</SelectLabel>
                        <SelectItem value="gpt-4o-mini">gpt-4o-mini</SelectItem>
                        <SelectItem value="gpt-4o">gpt-4o</SelectItem>
                        <SelectItem value="gpt-4.1">gpt-4.1</SelectItem>
                        <SelectItem value="gpt-4.1-mini">gpt-4.1-mini</SelectItem>
                        <SelectItem value="o4-mini">o4-mini</SelectItem>
                        <SelectItem value="gpt-5">gpt-5</SelectItem>
                      </SelectGroup>
                      <SelectGroup>
                        <SelectLabel>Anthropic (Claude)</SelectLabel>
                        <SelectItem value="claude-4-opus-latest">claude-4-opus-latest</SelectItem>
                        <SelectItem value="claude-4-sonnet-latest">claude-4-sonnet-latest</SelectItem>
                      </SelectGroup>
                      <SelectGroup>
                        <SelectLabel>Google (Gemini)</SelectLabel>
                        <SelectItem value="models/gemini-1.5-flash">gemini-1.5-flash</SelectItem>
                        <SelectItem value="models/gemini-1.5-pro">gemini-1.5-pro</SelectItem>
                        <SelectItem value="models/gemini-2.0-flash">gemini-2.0-flash</SelectItem>
                        <SelectItem value="models/gemini-2.5-pro">gemini-2.5-pro</SelectItem>
                        <SelectItem value="models/gemini-2.5-flash">gemini-2.5-flash</SelectItem>
                        <SelectItem value="models/gemini-2.5-flash-lite">gemini-2.5-flash-lite</SelectItem>
                      </SelectGroup>
                      <SelectGroup>
                        <SelectLabel>Groq (Llama/Mixtral)</SelectLabel>
                        <SelectItem value="groq/llama-3.1-70b-versatile">llama-3.1-70b-versatile</SelectItem>
                        <SelectItem value="groq/llama-3.1-8b-instant">llama-3.1-8b-instant</SelectItem>
                        <SelectItem value="groq/mixtral-8x7b-32768">mixtral-8x7b-32768</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="temperature">Temperature <span className="text-xs text-neutral-500">{temperature.toFixed(2)}</span> {!temperatureSupported && (<span className="text-xs text-neutral-500">(not supported for this model)</span>)}
                    </Label>
                    <Slider id="temperature" min={0} max={1} step={0.01} value={[temperature]} onValueChange={(v) => setTemperature(Math.max(0, Math.min(1, Number(v?.[0] ?? 0))))} disabled={!temperatureSupported} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prompt">Prompt (optional)</Label>
                  <Textarea id="prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Custom instructions for the matcher" rows={6} />
                </div>
                <div className="space-y-2">
                  <Button onClick={onCreateMatch} disabled={isSubmitting || isTaskActive}>
                    {isSubmitting ? "Enqueuing..." : isTaskActive ? "Running..." : "Run Match"}
                  </Button>
                  {taskId && (
                    <div className="space-y-1">
                      <div className="text-xs text-neutral-500">Task: {taskId}</div>
                      {isTaskActive ? (
                        <div className="space-y-1">
                          {typeof taskItem?.progress === "number" && (
                            <Progress value={Math.max(0, Math.min(100, Number(taskItem.progress)))} />
                          )}
                          <div className="text-xs text-neutral-500">
                            Status: {taskItem?.status ?? "pending"}{taskItem?.progressMessage ? ` – ${taskItem.progressMessage}` : ""}
                          </div>
                        </div>
                      ) : taskItem ? (
                        <div className="space-y-2">
                          <div className="text-xs text-neutral-500">Finished: {taskItem.status}</div>
                          {taskItem.status === "failed" && taskItem.errorSummary ? (
                            <div>
                              <div className="text-xs font-medium">Error</div>
                              <ScrollArea className="h-24 border border-[var(--border)] rounded">
                                <pre className="p-2 text-[11px] whitespace-pre-wrap">{String(taskItem.errorSummary)}</pre>
                              </ScrollArea>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {scoring && scoring.debug && (
        <Accordion type="single" collapsible defaultValue="debug">
          <AccordionItem value="debug">
            <AccordionTrigger>Debug details</AccordionTrigger>
            <AccordionContent>
              <ScrollArea className="h-72 border border-[var(--border)] rounded">
                <pre className="p-3 text-xs whitespace-pre-wrap">{JSON.stringify(scoring.debug, null, 2)}</pre>
              </ScrollArea>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}

      <div className="mt-8">
        <h2 className="mb-3">Profiles</h2>
        {!selectedCandidateId && !selectedJobId ? (
          <div className="text-neutral-400">Select items to preview profiles</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Candidate</CardTitle>
              </CardHeader>
              <CardContent>
              {!selectedCandidateId ? (
                <div className="text-neutral-400 text-sm">No candidate selected</div>
              ) : candProfileRes === undefined ? (
                <div className="text-neutral-400 text-sm">Loading...</div>
              ) : candProfile ? (
                <div className="space-y-3 text-sm">
                  {candProfile.summary && (
                    <div>
                      <div className="font-medium mb-1">Summary</div>
                      <p className="whitespace-pre-wrap">{candProfile.summary}</p>
                    </div>
                  )}
                  {Array.isArray(candProfile.skills) && candProfile.skills.length > 0 && (
                    <div>
                      <div className="font-medium mb-1">Skills</div>
                      <div className="flex flex-wrap gap-2">
                        {candProfile.skills.map((s: any, i: number) => (
                          <Badge key={i} variant="outline" className="px-2 py-1">{s.name} {typeof s.score === "number" ? `(${Math.round(s.score)})` : ""}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {Array.isArray(candProfile.education) && candProfile.education.length > 0 && (
                    <div>
                      <div className="font-medium mb-1">Education</div>
                      <ul className="list-disc pl-5 space-y-1">
                        {candProfile.education.map((e: any, idx: number) => (
                          <li key={idx}>
                            {[e.degree, e.field, e.institution].filter(Boolean).join(", ")}
                            {" "}({[e.startDate, e.endDate].filter(Boolean).join(" – ")})
                            {e.notes ? ` – ${e.notes}` : ""}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {Array.isArray(candProfile.workExperience) && candProfile.workExperience.length > 0 && (
                    <div>
                      <div className="font-medium mb-1">Work Experience</div>
                      <ul className="list-disc pl-5 space-y-2">
                        {candProfile.workExperience.map((w: any, idx: number) => (
                          <li key={idx}>
                            <div className="font-medium">{[w.title, w.company].filter(Boolean).join(" @ ")}</div>
                            <div className="text-sm muted">{[w.startDate, w.endDate].filter(Boolean).join(" – ")}</div>
                            {Array.isArray(w.responsibilities) && w.responsibilities.length > 0 && (
                              <ul className="list-disc pl-5 mt-1 space-y-1">
                                {w.responsibilities.map((r: string, rIdx: number) => (
                                  <li key={rIdx}>{r}</li>
                                ))}
                              </ul>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-neutral-400 text-sm">No profile found</div>
              )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Job</CardTitle>
              </CardHeader>
              <CardContent>
              {!selectedJobId ? (
                <div className="text-neutral-400 text-sm">No job selected</div>
              ) : jobProfileRes === undefined ? (
                <div className="text-neutral-400 text-sm">Loading...</div>
              ) : jobProfile ? (
                <div className="space-y-3 text-sm">
                  {jobProfile.summary && (
                    <div>
                      <div className="font-medium mb-1">Summary</div>
                      <p className="whitespace-pre-wrap">{jobProfile.summary}</p>
                    </div>
                  )}
                  {Array.isArray(jobProfile.skills) && jobProfile.skills.length > 0 && (
                    <div>
                      <div className="font-medium mb-1">Skills</div>
                      <div className="flex flex-wrap gap-2">
                        {jobProfile.skills.map((s: any, i: number) => (
                          <Badge key={i} variant="outline" className="px-2 py-1">{s.name} {typeof s.score === "number" ? `(${Math.round(s.score)})` : ""}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {Array.isArray(jobProfile.responsibilities) && jobProfile.responsibilities.length > 0 && (
                    <div>
                      <div className="font-medium mb-1">Responsibilities</div>
                      <ul className="list-disc pl-5 space-y-1">
                        {jobProfile.responsibilities.map((r: string, i: number) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {Array.isArray(jobProfile.requirements) && jobProfile.requirements.length > 0 && (
                    <div>
                      <div className="font-medium mb-1">Requirements</div>
                      <ul className="list-disc pl-5 space-y-1">
                        {jobProfile.requirements.map((r: string, i: number) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-neutral-400 text-sm">No profile found</div>
              )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

    </div>
  );
}

function ScoreCard({ label, value, highlight }: { label: string; value?: number; highlight?: boolean }) {
  const display = value === undefined ? "-" : `${(value * 100).toFixed(1)}%`;
  return (
    <Card className={highlight ? "border-primary/60" : undefined}>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs text-neutral-400 font-normal">{label}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="text-2xl font-semibold">{display}</div>
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


