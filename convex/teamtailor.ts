import {
    mutation,
    action,
    query,
    internalAction,
    internalMutation,
  } from "./_generated/server";
import { api, components, internal } from "./_generated/api";
import { v } from "convex/values";
import { vWorkIdValidator } from "@convex-dev/workpool";
import { internal as internalApi } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { enqueueTrackedAction } from "./tasks";


// Use centralized enqueue API; pools are resolved in tasks.enqueueTask

async function fetchAllPages(url: string, headers: Record<string, string>): Promise<Array<any>> {
    const all: Array<any> = [];
    let next: string | null = url;
    while (next) {
        const res: Response = await fetch(next, { headers });
        if (!res.ok) break;
        const json: any = await res.json();
        const items: Array<any> = json?.data ?? [];
        all.push(...items);
        // Teamtailor uses JSON:API style; some endpoints include links.next
        next = (json?.links?.next as string | undefined) ?? null;
        // Also support pagination via meta.page-count if provided; if no links.next, stop
        if (!next) break;
    }
    return all;
}
async function fetchAssesment(activitiesUrl: string, headers: Record<string, string>): Promise<string> {
    let review = "";
    for (const code of ["review", "application_review"]) {
        const url = `${activitiesUrl}${activitiesUrl.includes("?") ? "&" : "?"}filter[code]=${code}`;
        const items = await fetchAllPages(url, headers);
        for (const item of items) {
            const raw: any = item?.attributes?.data;
            if (!raw) continue;
            let text: string | null = null;
            if (typeof raw === "string") {
                try {
                    const parsed: any = JSON.parse(raw);
                    if (parsed && typeof parsed.comment === "string") {
                        text = parsed.comment;
                    } else if (typeof parsed === "string") {
                        text = parsed;
                    } else {
                        text = raw;
                    }
                } catch {
                    text = raw;
                }
            } else if (typeof raw === "object" && raw !== null) {
                if (typeof raw.comment === "string") text = raw.comment;
            }
            if (text && text.trim().length > 0) {
                review += text.trim() + "\n";
            }
        }
    }
    return review;
}


async function getHubertOpenSummaryUrl(partnerResultsUrl: string, apiKey: string): Promise<{ url: string | null; raw: Array<any> }> {
    const headers: Record<string, string> = {
        Authorization: `Token token=${apiKey}`,
        "X-Api-Version": "20210218",
        "Content-Type": "application/json",
    };
    const items = await fetchAllPages(partnerResultsUrl, headers);
    let foundUrl: string | null = null;
    for (const item of items) {
        const attrs = item?.attributes ?? {};
        const partnerName: string | undefined = attrs["partner-name"];
        if (partnerName && partnerName.toLowerCase() === "hubert.ai" && Array.isArray(attrs.attachments)) {
            const hit = attrs.attachments.find((a: any) => a?.description === "Open Application Summary" && a?.url);
            if (hit?.url) {
                foundUrl = hit.url as string;
                break;
            }
        }
    }
    return { url: foundUrl, raw: items };
}


function extractHubertApplicationId(shareUrl: string): string | null {
    try {
        const url = new URL(shareUrl);
        const parts = url.pathname.split("/").filter(Boolean);
        // Expect .../application/share/{applicationId}
        const id = parts[parts.length - 1];
        return id || null;
    } catch {
        return null;
    }
}

async function fetchHubertOpenApplication(
    endpoint: string,
    applicationId: string,
    referer?: string
): Promise<any> {
    const query = `query pub_OpenApplication($applicationId: String!) {\n  OpenApplication(applicationId: $applicationId) {\n    id\n    score\n    status\n    score\n    stage\n    createdAt\n    accepted\n    activityLog {\n      createdAt\n      status\n      stage\n      actionType\n      message\n      __typename\n    }\n    candidate {\n      id\n      firstName\n      lastName\n      email\n      phoneNumber\n      __typename\n    }\n    job {\n      id\n      company\n      title\n      threshold\n      location {\n        name\n        __typename\n      }\n      position\n      __typename\n    }\n    _summaries {\n      id\n      threshold\n      aiDetection {\n        isAi\n        score\n        tag\n        __typename\n      }\n      summaryPart: summary {\n        header\n        icon\n        bonuspoints\n        average\n        points\n        maxPoints\n        threshold\n        details {\n          label\n          question\n          icon\n          answer\n          points\n          bonuspoints\n          isCorrect\n          qualified\n          options {\n            label\n            points\n            isCorrect\n            answered\n            evaluation {\n              name\n              value\n              bonus_points\n              __typename\n            }\n            __typename\n          }\n          aiDetection {\n            isAi\n            score\n            tag\n            __typename\n          }\n          reset\n          __typename\n        }\n        __typename\n      }\n      __typename\n    }\n    __typename\n  }\n}`;
    const res: Response = await fetch(endpoint, {
        method: "POST",
        headers: {
            "content-type": "application/json",
            ...(referer ? { Referer: referer, Origin: new URL(referer).origin } : {}),
        },
        body: JSON.stringify({ operationName: "pub_OpenApplication", variables: { applicationId }, query }),
    });
    if (!res.ok) {
        throw new Error(`Hubert GQL error: ${res.status} ${res.statusText}`);
    }
    const json: any = await res.json();
    return json;
}

function mapHubertAnswersFromOpenApplication(openAppJson: any): Array<any> {
    const summaries: Array<any> = openAppJson?.data?.OpenApplication?._summaries ?? [];
    const answers: Array<any> = [];
    for (const s of summaries) {
        const summaryPart = s?.summaryPart;
        const parts: Array<any> = Array.isArray(summaryPart) ? summaryPart : (summaryPart ? [summaryPart] : []);
        for (const part of parts) {
            const details: Array<any> = part?.details ?? [];
            for (const d of details) {
                const normalizedAnswer = typeof d?.answer === "string" ? d.answer : (d?.answer ?? null);
                answers.push({
                    header: part?.header ?? null,
                    label: d?.label ?? null,
                    question: d?.question ?? null,
                    answer: normalizedAnswer,
                    points: d?.points ?? null,
                    bonuspoints: d?.bonuspoints ?? null,
                    isCorrect: d?.isCorrect ?? null,
                    qualified: d?.qualified ?? null,
                });
            }
        }
    }
    return answers;
}

// Internal function that will be executed by the workpool
export const importCandidateToDb = internalAction({
    args: {
        candidateId: v.string(),
        taskId: v.optional(v.string()),
    },
    returns: v.object({
        success: v.boolean(),
        candidateId: v.optional(v.string()),
        teamtailorId: v.optional(v.string()),
        error: v.optional(v.string()),
        message: v.string(),
    }),
    handler: async (ctx, args) => {
        if (args.taskId) {
            try { await ctx.runMutation(internal.tasks.markStarted, { taskId: args.taskId }); } catch {}
            try { await ctx.runMutation(internal.tasks.updateProgress, { taskId: args.taskId, progress: 5, message: "Started" }); } catch {}
        }
        try {
            // Teamtailor API configuration
            const apiKey = process.env.TEAMTAILOR_API_KEY;
            const baseUrl = process.env.TEAMTAILOR_BASE_URL || "https://api.teamtailor.com/v1";
            
            if (!apiKey) {
                throw new Error("TEAMTAILOR_API_KEY environment variable is required");
            }

            // Fetch candidate from Teamtailor API
            const response = await fetch(`${baseUrl}/candidates/${args.candidateId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Token token=${apiKey}`,
                    'X-Api-Version': '20210218',
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error(`Teamtailor API error: ${response.status} ${response.statusText}`);
            }

            const candidateResponse = await response.json();
            if (args.taskId) { try { await ctx.runMutation(internal.tasks.updateProgress, { taskId: args.taskId, progress: 20, message: "Fetched candidate" }); } catch {} }
            console.log(candidateResponse.data);
            // Extract image URL from Teamtailor data if present
            const pictureUrl: string | undefined = (() => {
                try {
                    const attrs: any = candidateResponse?.data?.attributes ?? {};
                    if (typeof attrs?.picture === "string") return attrs.picture;
                    if (typeof attrs?.avatar === "string") return attrs.avatar;
                    if (typeof attrs?.image === "string") return attrs.image;
                    const relationships: any = candidateResponse?.data?.relationships ?? {};
                    const picRel: any = relationships?.picture ?? relationships?.avatar ?? relationships?.image;
                    if (typeof picRel?.links?.related === "string") return picRel.links.related;
                } catch {}
                return undefined;
            })();

            //create candidate record in database
            const candidateId = await ctx.runMutation((internal as any).candidates.createCandidateRecord, {
                teamtailorId: candidateResponse.data.id,
                name: `${candidateResponse.data.attributes["first-name"] ?? ""} ${candidateResponse.data.attributes["last-name"] ?? ""}`.trim(),
                imageUrl: pictureUrl ?? undefined,
                email: (candidateResponse.data.attributes.email ?? undefined),
                phone: candidateResponse.data.attributes.phone || undefined,
                updatedAt: Date.parse(candidateResponse.data.attributes["updated-at"]),
                rawData: candidateResponse.data,
            });
            if (args.taskId) { try { await ctx.runMutation(internal.tasks.updateProgress, { taskId: args.taskId, progress: 45, message: "Saved candidate" }); } catch {} }
            // mark candidate processing status
            try {
                await ctx.runMutation((internal as any).candidates.setCandidateProcessingStatus, { candidateId: candidateId!, processingStatus: "imported" });
            } catch {}

            // Collect source data to pass to profile builder
            let hubertAnswersVar: Array<any> | undefined = undefined;
            let assessmentText: string | undefined = undefined;
            let resumeUrlVar: string | undefined = undefined;

            // Fetch Hubert partner results and store in candidateSourceData
            const partnerResultsUrl: string | undefined = candidateResponse?.data?.relationships?.["partner-results"]?.links?.related;
            if (partnerResultsUrl) {
                const { url: hubertOpenSummaryUrl } = await getHubertOpenSummaryUrl(partnerResultsUrl, apiKey);
                const nowMs = Date.now();
                await ctx.runMutation((internal as any).candidates.upsertCandidateSourceData, {
                    candidateId: candidateId!,
                    hubertOpenSummaryUrl: hubertOpenSummaryUrl ?? undefined,
                    updatedAt: nowMs,
                });
                if (args.taskId) { try { await ctx.runMutation(internal.tasks.updateProgress, { taskId: args.taskId, progress: 55, message: "Saved Hubert link" }); } catch {} }

                // If we have a share url, extract applicationId and fetch Q/A via GraphQL
                if (hubertOpenSummaryUrl) {
                    const applicationId: string | null = extractHubertApplicationId(hubertOpenSummaryUrl);
                    if (applicationId) {
                        try {
                            const gqlJson: any = await fetchHubertOpenApplication("https://app.hubert.ai/graphql", applicationId, hubertOpenSummaryUrl);
                            const hubertAnswers: Array<any> = mapHubertAnswersFromOpenApplication(gqlJson);
                            await ctx.runMutation((internal as any).candidates.upsertCandidateSourceData, {
                                candidateId: candidateId!,
                                hubertAnswers: hubertAnswers.length > 0 ? hubertAnswers : undefined,
                                updatedAt: Date.now(),
                            });
                            hubertAnswersVar = hubertAnswers.length > 0 ? hubertAnswers : undefined;
                            if (args.taskId) { try { await ctx.runMutation(internal.tasks.updateProgress, { taskId: args.taskId, progress: 65, message: "Fetched Hubert answers" }); } catch {} }
                        } catch (e) {
                            console.warn("Failed to fetch Hubert OpenApplication GraphQL:", e);
                        }
                    }
                }
            }

            // CV: keep URL; profile building happens via OpenAI workpool on demand
            try {
                const resumeUrl: string | undefined = candidateResponse?.data?.attributes?.resume ?? candidateResponse?.data?.attributes?.["original-resume"];
                if (resumeUrl) {
                    // Store only that a CV exists; do not persist sourceUrl
                    await ctx.runMutation((internal as any).candidates.upsertCandidateSourceData, {
                        candidateId: candidateId!,
                        cv: { hasCv: true },
                        updatedAt: Date.now(),
                    });
                    resumeUrlVar = resumeUrl;
                    if (args.taskId) { try { await ctx.runMutation(internal.tasks.updateProgress, { taskId: args.taskId, progress: 72, message: "CV detected" }); } catch {} }
                }
            } catch (_e) {}



            // Fetch reviews/application_reviews and store aggregated text
            const activitiesUrl: string | undefined = candidateResponse?.data?.relationships?.["activities"]?.links?.related;
            if (activitiesUrl) {
                try {
                    const headers: Record<string, string> = {
                        Authorization: `Token token=${apiKey}`,
                        "X-Api-Version": "20210218",
                        "Content-Type": "application/json",
                        Accept: "application/vnd.api+json",
                    };
                    const reviewItems = await Promise.all([
                        fetchAllPages(`${activitiesUrl}?filter[code]=review`, headers),
                        fetchAllPages(`${activitiesUrl}?filter[code]=application_review`, headers),
                    ]);
                    const assessment: string = await fetchAssesment(activitiesUrl, headers);
                    await ctx.runMutation((internal as any).candidates.upsertCandidateSourceData, {
                        candidateId: candidateId!,
                        updatedAt: Date.now(),
                        assessment,
                    });
                    assessmentText = assessment;
                } catch (e) {
                    console.warn("Failed to fetch Teamtailor reviews:", e);
                }
            }

            // If we have a resume, enqueue CV summarization first; build_profile will be chained on success
            if (resumeUrlVar) {
                try {
                    await ctx.runMutation(api.tasks.enqueueTask as any, {
                        taskType: "cv_summarize",
                        candidateId: candidateId!,
                        resumeUrl: resumeUrlVar,
                        argsSummary: { candidateId: candidateId!, resumeUrl: resumeUrlVar },
                        requestedBy: "system",
                    } as any);
                    try { await ctx.runMutation((internal as any).candidates.setCandidateProcessingStatus, { candidateId: candidateId!, processingStatus: "cv_summarizing" }); } catch {}
                    if (args.taskId) { try { await ctx.runMutation(internal.tasks.updateProgress, { taskId: args.taskId, progress: 85, message: "Enqueued CV summarize" }); } catch {} }
                } catch (e) {
                    console.warn("Failed to enqueue CV summarization:", e);
                }
            } else if (assessmentText || hubertAnswersVar) {
                // If no resume, go straight to build_profile using other sources
                try {
                    await ctx.runMutation(api.tasks.enqueueTask as any, {
                        taskType: "build_profile",
                        candidateId: candidateId!,
                        argsSummary: { candidateId: candidateId! },
                        requestedBy: "system",
                    } as any);
                    try { await ctx.runMutation((internal as any).candidates.setCandidateProcessingStatus, { candidateId: candidateId!, processingStatus: "profile_building" }); } catch {}
                    if (args.taskId) { try { await ctx.runMutation(internal.tasks.updateProgress, { taskId: args.taskId, progress: 85, message: "Enqueued profile build" }); } catch {} }
                } catch (e) {
                    console.warn("Failed to enqueue OpenAI profile build:", e);
                }
            }
            
            // Print the result
            console.log("Candidate imported from Teamtailor:");
            
            if (args.taskId) { try { await ctx.runMutation(internal.tasks.updateProgress, { taskId: args.taskId, progress: 100, message: "Done" }); } catch {} }
            return {
                success: true,
                message: `Successfully imported candidate with ID: ${args.candidateId}`
            };
            
        } catch (error) {
            console.error("Error importing candidate:", error);
            return {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error occurred",
                message: `Failed to import candidate with ID: ${args.candidateId}`
            };
        }
    },
});

// Internal mutation to create candidate record in database
export const createCandidateRecord = internalMutation({
    args: {
        teamtailorId: v.string(),
        name: v.string(),
        email: v.optional(v.string()),
        phone: v.optional(v.string()),
        updatedAt: v.number(),
        rawData: v.any(),
    },
    returns: v.union(v.id("candidates"), v.null()),
    handler: async (ctx, args) => {
        // Check if candidate already exists
        const existingCandidate = await ctx.db
            .query("candidates")
            .withIndex("by_teamtailor_id", (q) => q.eq("teamtailorId", args.teamtailorId))
            .first();
            
        if (existingCandidate) {
            console.log(`Candidate with Teamtailor ID ${args.teamtailorId} already exists, updating...`);
            await ctx.db.patch(existingCandidate._id, {
                name: args.name,
                email: args.email,
                phone: args.phone,
                updatedAt: args.updatedAt,
                rawData: args.rawData,
            });
            return existingCandidate._id;
        }
        
        // Create new candidate record
        const newId = await ctx.db.insert("candidates", {
            teamtailorId: args.teamtailorId,
            name: args.name,
            email: args.email,
            phone: args.phone,
            updatedAt: args.updatedAt,
            rawData: args.rawData,
        });
        return newId;
    },
});

// Upsert candidate source data (Hubert URLs, etc.)
export const upsertCandidateSourceData = internalMutation({
    args: {
        candidateId: v.id("candidates"),
        assessment: v.optional(v.any()),
        hubertAnswers: v.optional(v.any()),
        cv: v.optional(v.any()),
        hubertOpenSummaryUrl: v.optional(v.string()),
        updatedAt: v.number(),
    },
    returns: v.union(v.id("candidateSourceData"), v.null()),
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("candidateSourceData")
            .withIndex("by_candidate_id", (q) => q.eq("candidateId", args.candidateId))
            .first();
        if (existing) {
            const update = {
                assessment: args.assessment ?? existing.assessment,
                hubertAnswers: args.hubertAnswers ?? existing.hubertAnswers,
                cv: args.cv ?? existing.cv,
                hubertOpenSummaryUrl: args.hubertOpenSummaryUrl ?? existing.hubertOpenSummaryUrl,
                updatedAt: args.updatedAt,
            };
            await ctx.db.patch(existing._id, update as any);
            return existing._id;
        }
        const doc: any = {
            candidateId: args.candidateId,
            assessment: args.assessment,
            hubertAnswers: args.hubertAnswers,
            cv: args.cv,
            hubertOpenSummaryUrl: args.hubertOpenSummaryUrl,
            updatedAt: args.updatedAt,
        };
        return await ctx.db.insert("candidateSourceData", doc as any);
    },
});

// Internal mutations to update processing status fields
export const setCandidateProcessingStatus = internalMutation({
    args: { candidateId: v.id("candidates"), processingStatus: v.string() },
    returns: v.null(),
    handler: async (ctx, args) => {
        try { await ctx.db.patch(args.candidateId as any, { processingStatus: args.processingStatus } as any); } catch {}
        return null;
    },
});

export const setJobProcessingStatus = internalMutation({
    args: { jobId: v.id("jobs"), processingStatus: v.string() },
    returns: v.null(),
    handler: async (ctx, args) => {
        try { await ctx.db.patch(args.jobId as any, { processingStatus: args.processingStatus } as any); } catch {}
        return null;
    },
});



// Function to enqueue multiple candidate imports using workpool
export const enqueueCandidateImports = mutation({
    args: {
        candidateIds: v.array(v.string()),
    },
    returns: v.object({
        success: v.boolean(),
        jobIds: v.array(v.string()),
        message: v.string(),
    }),
    handler: async (ctx, args) => {
        const jobIds: string[] = [];
        
        for (const candidateId of args.candidateIds) {
            const { taskId, workId } = await ctx.runMutation(api.tasks.enqueueTask as any, {
                taskType: "import",
                candidateId,
                argsSummary: { candidateId },
                requestedBy: "system",
            } as any);
            const jobId = workId;
            jobIds.push(jobId);
          
        }
        
        console.log(`Enqueued ${args.candidateIds.length} candidate imports with job IDs:`, jobIds);
        
        return {
            success: true,
            jobIds: jobIds,
            message: `Enqueued ${args.candidateIds.length} candidate imports`
        };
    },
});



// Upsert job source data
export const upsertJobSourceData = internalMutation({
    args: {
        jobId: v.id("jobs"),
        body: v.optional(v.string()),
        links: v.optional(v.record(v.string(), v.string())),
        tags: v.optional(v.array(v.string())),
        recruiterEmail: v.optional(v.string()),
        remoteStatus: v.optional(v.string()),
        languageCode: v.optional(v.string()),
        mailbox: v.optional(v.string()),
        humanStatus: v.optional(v.string()),
        internal: v.optional(v.boolean()),
        createdAt: v.optional(v.number()),
        startDate: v.optional(v.number()),
        endDate: v.optional(v.number()),
        updatedAt: v.number(),
    },
    returns: v.union(v.id("jobSourceData"), v.null()),
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("jobSourceData")
            .withIndex("by_job_id", (q) => q.eq("jobId", args.jobId))
            .first();
        const doc: any = {
            body: args.body,
            links: args.links,
            tags: args.tags,
            recruiterEmail: args.recruiterEmail,
            remoteStatus: args.remoteStatus,
            languageCode: args.languageCode,
            mailbox: args.mailbox,
            humanStatus: args.humanStatus,
            internal: args.internal,
            createdAt: args.createdAt,
            startDate: args.startDate,
            endDate: args.endDate,
            updatedAt: args.updatedAt,
        };
        if (existing) {
            await ctx.db.patch(existing._id, doc);
            return existing._id;
        }
        return await ctx.db.insert("jobSourceData", { jobId: args.jobId, ...doc } as any);
    },
});

// Query to get the status of a single job
export const getJobStatus = query({
    args: {
        jobId: vWorkIdValidator,
    },
    returns: v.union(
        v.object({
            state: v.literal("pending"),
            previousAttempts: v.number(),
        }),
        v.object({
            state: v.literal("running"),
            previousAttempts: v.number(),
        }),
        v.object({
            state: v.literal("finished"),
        })
    ),
    handler: async (ctx, args) => {
        return { state: "finished" } as any;
    },
});

// Query to get the status of multiple jobs
export const getBatchJobStatus = query({
    args: {
        jobIds: v.array(vWorkIdValidator),
    },
    returns: v.array(
        v.union(
            v.object({
                state: v.literal("pending"),
                previousAttempts: v.number(),
            }),
            v.object({
                state: v.literal("running"),
                previousAttempts: v.number(),
            }),
            v.object({
                state: v.literal("finished"),
            })
        )
    ),
    handler: async (ctx, args) => {
        return args.jobIds.map(() => ({ state: "finished" } as any));
    },
});

// Mutation to cancel a specific job
export const cancelJob = mutation({
    args: {
        jobId: vWorkIdValidator,
    },
    returns: v.null(),
    handler: async (ctx, args) => {
        return null;
        console.log(`Cancelled job: ${args.jobId}`);
        return null;
    },
});

// Mutation to cancel all jobs
export const cancelAllJobs = mutation({
    args: {},
    returns: v.null(),
    handler: async (ctx) => {
        return null;
        console.log("Cancelled all jobs");
      
        return null;
    },
});

export const getWorkpoolOverview = query({
    args: {},
    returns: v.object({
        teamtailor: v.object({ pending: v.number(), running: v.number(), finished: v.number() }),
        openai: v.object({ pending: v.number(), running: v.number(), finished: v.number() }),
    }),
    handler: async (ctx) => {
        const tallyByPool = async (poolName: "teamtailor" | "openai") => {
            const ids: Array<string> = [];
          
            if (ids.length === 0) return { pending: 0, running: 0, finished: 0 };
            const statuses: any[] = [];
            let pending = 0, running = 0, finished = 0;
            for (const st of statuses as any[]) {
                if (st?.state === "pending") pending++;
                else if (st?.state === "running") running++;
                else if (st?.state === "finished") finished++;
            }
            return { pending, running, finished };
        };
        return {
            teamtailor: await tallyByPool("teamtailor"),
            openai: await tallyByPool("openai"),
        };
    },
});

// Query to get all candidates
export const getCandidates = query({
    args: {},
    returns: v.array(v.any()),
    handler: async (ctx) => {
        const candidates = await ctx.db.query("candidates").collect();
        return candidates;
    },
});

// Public query to fetch source data for a list of candidateIds
export const getSourceDataByCandidateIds = query({
    args: { candidateIds: v.array(v.id("candidates")) },
    returns: v.array(
        v.object({
            candidateId: v.id("candidates"),
            assessment: v.optional(v.any()),
            hubertAnswers: v.optional(v.any()),
            cv: v.optional(v.any()),
            hubertOpenSummaryUrl: v.optional(v.string()),
            updatedAt: v.number(),
        })
    ),
    handler: async (ctx, args) => {
        const results: Array<any> = [];
        for (const id of args.candidateIds) {
            const row = await ctx.db
                .query("candidateSourceData")
                .withIndex("by_candidate_id", (q) => q.eq("candidateId", id))
                .first();
            if (row) {
                results.push({
                    candidateId: row.candidateId,
                    assessment: row.assessment,
                    hubertAnswers: row.hubertAnswers,
                    cv: row.cv,
                    hubertOpenSummaryUrl: row.hubertOpenSummaryUrl,
                    updatedAt: row.updatedAt,
                });
            }
        }
        return results;
    },
});

// Query to get candidate by Teamtailor ID
export const getCandidateByTeamtailorId = query({
    args: {
        teamtailorId: v.string(),
    },
    returns: v.union(v.any(), v.null()),
    handler: async (ctx, args) => {
        const candidate = await ctx.db
            .query("candidates")
            .withIndex("by_teamtailor_id", (q) => q.eq("teamtailorId", args.teamtailorId))
            .first();
        return candidate;
    },
});


// Keep the original function for backward compatibility
export const importCandidate = action({
    args: {
        candidateId: v.string(),
    },
    returns: v.object({
        success: v.boolean(),
        candidate: v.any(),
        message: v.string(),
    }),
    handler: async (ctx, args) => {
        try {
            // Teamtailor API configuration
            // You'll need to set these environment variables in your Convex dashboard
            const apiKey = process.env.TEAMTAILOR_API_KEY;
            const baseUrl = process.env.TEAMTAILOR_BASE_URL || "https://api.teamtailor.com/v1";
            
            if (!apiKey) {
                throw new Error("TEAMTAILOR_API_KEY environment variable is required");
            }

            // Fetch candidate from Teamtailor API
            const response = await fetch(`${baseUrl}/candidates/${args.candidateId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Token token=${apiKey}`,
                    'X-Api-Version': '20210218',
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error(`Teamtailor API error: ${response.status} ${response.statusText}`);
            }

            const candidate = await response.json();
            
            // Print the result
            console.log("Candidate imported from Teamtailor:");
            console.log(JSON.stringify(candidate, null, 2));
            
            return {
                success: true,
                candidate: candidate,
                message: `Successfully imported candidate with ID: ${args.candidateId}`
            };
            
        } catch (error) {
            console.error("Error importing candidate:", error);
            return {
                success: false,
                candidate: null,
                error: error instanceof Error ? error.message : "Unknown error occurred",
                message: `Failed to import candidate with ID: ${args.candidateId}`
            };
        }
    },
});

// =========================
// Jobs pipeline (Teamtailor)
// =========================

export const importJobToDb = internalAction({
    args: {
        jobId: v.string(),
        taskId: v.optional(v.string()),
    },
    returns: v.object({
        success: v.boolean(),
        jobId: v.optional(v.string()),
        teamtailorId: v.optional(v.string()),
        error: v.optional(v.string()),
        message: v.string(),
    }),
    handler: async (ctx, args): Promise<{
        success: boolean;
        jobId?: string;
        teamtailorId?: string;
        error?: string;
        message: string;
    }> => {
        if (args.taskId) {
            try { await ctx.runMutation(internal.tasks.markStarted, { taskId: args.taskId }); } catch {}
            try { await ctx.runMutation(internal.tasks.updateProgress, { taskId: args.taskId, progress: 5, message: "Started" }); } catch {}
        }
        try {
            const apiKey = process.env.TEAMTAILOR_API_KEY;
            const baseUrl = process.env.TEAMTAILOR_BASE_URL || "https://api.teamtailor.com/v1";
            if (!apiKey) {
                throw new Error("TEAMTAILOR_API_KEY environment variable is required");
            }
            const response = await fetch(`${baseUrl}/jobs/${args.jobId}`, {
                method: "GET",
                headers: {
                    Authorization: `Token token=${apiKey}`,
                    "X-Api-Version": "20210218",
                    "Content-Type": "application/json",
                },
            });
            if (!response.ok) {
                throw new Error(`Teamtailor API error: ${response.status} ${response.statusText}`);
            }
            const jobResponse: any = await response.json();
            const data = jobResponse?.data;
            if (!data) {
                throw new Error("No job data returned from Teamtailor");
            }
            if (args.taskId) { try { await ctx.runMutation(internal.tasks.updateProgress, { taskId: args.taskId, progress: 25, message: "Fetched job" }); } catch {} }

            const baseAttrs = data.attributes ?? {};
            const title: string | undefined = baseAttrs.title ?? baseAttrs.name;
            const status: string | undefined = baseAttrs.status ?? baseAttrs.state;
            const department: string | undefined = baseAttrs.department ?? baseAttrs["department-name"];
            const location: string | undefined = baseAttrs.location ?? baseAttrs["location-name"];
            const updatedAtMs: number = Date.parse(baseAttrs["updated-at"]) || Date.now();

            const storedId: Id<"jobs"> | null = await ctx.runMutation((internal as any).jobs.upsertJobRecord, {
                teamtailorId: data.id as string,
                title,
                status,
                department,
                location,
                updatedAt: updatedAtMs,
                rawData: data,
            });
            if (args.taskId) { try { await ctx.runMutation(internal.tasks.updateProgress, { taskId: args.taskId, progress: 55, message: "Saved job" }); } catch {} }

            // Upsert job source data
            const attrs: any = data.attributes ?? {};
            const links: any = data.links ?? {};
            const sourceLinks: Record<string, string> = {};
            for (const k of Object.keys(links)) {
                const v = links[k];
                if (typeof v === "string") sourceLinks[k] = v;
            }
            const createdAtMs: number | undefined = attrs["created-at"] ? Date.parse(attrs["created-at"]) : undefined;
            const startDateMs: number | undefined = attrs["start-date"] ? Date.parse(attrs["start-date"]) : undefined;
            const endDateMs: number | undefined = attrs["end-date"] ? Date.parse(attrs["end-date"]) : undefined;
            await ctx.runMutation((internal as any).jobs.upsertJobSourceData, {
                jobId: (storedId ?? undefined)!,
                body: typeof attrs.body === "string" ? attrs.body : undefined,
                links: Object.keys(sourceLinks).length > 0 ? sourceLinks : undefined,
                tags: Array.isArray(attrs.tags) ? attrs.tags.filter((t: any) => typeof t === "string") : undefined,
                recruiterEmail: typeof attrs["recruiter-email"] === "string" ? attrs["recruiter-email"] : undefined,
                remoteStatus: typeof attrs["remote-status"] === "string" ? attrs["remote-status"] : undefined,
                languageCode: typeof attrs["language-code"] === "string" ? attrs["language-code"] : undefined,
                mailbox: typeof attrs.mailbox === "string" ? attrs.mailbox : undefined,
                humanStatus: typeof attrs["human-status"] === "string" ? attrs["human-status"] : undefined,
                internal: typeof attrs.internal === "boolean" ? attrs.internal : undefined,
                createdAt: createdAtMs,
                startDate: startDateMs,
                endDate: endDateMs,
                updatedAt: Date.now(),
            });
            if (args.taskId) { try { await ctx.runMutation(internal.tasks.updateProgress, { taskId: args.taskId, progress: 75, message: "Saved job source data" }); } catch {} }

            // Enqueue job profile build
            try {
                const res = await ctx.runMutation(api.tasks.enqueueTask as any, {
                    taskType: "build_profile",
                    jobId: (storedId ?? undefined)!,
                    argsSummary: { jobId: storedId ?? undefined },
                    requestedBy: "system",
                } as any);
                try { await ctx.runMutation((internal as any).jobs.setJobProcessingStatus, { jobId: (storedId ?? undefined)!, processingStatus: "profile_building" }); } catch {}
                if (args.taskId) { try { await ctx.runMutation(internal.tasks.updateProgress, { taskId: args.taskId, progress: 95, message: "Enqueued job profile build" }); } catch {} }
            } catch (e) {
                console.warn("Failed to enqueue job profile build:", e);
            }

            if (args.taskId) { try { await ctx.runMutation(internal.tasks.updateProgress, { taskId: args.taskId, progress: 100, message: "Done" }); } catch {} }
            return {
                success: true,
                jobId: storedId ?? undefined,
                teamtailorId: data.id,
                message: `Successfully imported job with ID: ${args.jobId}`,
            };
        } catch (error) {
            console.error("Error importing job:", error);
            return {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error occurred",
                message: `Failed to import job with ID: ${args.jobId}`,
            };
        }
    },
});

export const upsertJobRecord = internalMutation({
    args: {
        teamtailorId: v.string(),
        title: v.optional(v.string()),
        status: v.optional(v.string()),
        department: v.optional(v.string()),
        location: v.optional(v.string()),
        updatedAt: v.number(),
        rawData: v.any(),
    },
    returns: v.union(v.id("jobs"), v.null()),
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("jobs")
            .withIndex("by_teamtailor_id", (q) => q.eq("teamtailorId", args.teamtailorId))
            .first();
        if (existing) {
            await ctx.db.patch(existing._id, {
                title: args.title,
                status: args.status,
                department: args.department,
                location: args.location,
                updatedAt: args.updatedAt,
                rawData: args.rawData,
            } as any);
            return existing._id;
        }
        const newId = await ctx.db.insert("jobs", {
            teamtailorId: args.teamtailorId,
            title: args.title,
            status: args.status,
            department: args.department,
            location: args.location,
            updatedAt: args.updatedAt,
            rawData: args.rawData,
        } as any);
        return newId;
    },
});

export const enqueueJobImports = mutation({
    args: {
        jobIds: v.array(v.string()),
    },
    returns: v.object({
        success: v.boolean(),
        jobIds: v.array(v.string()),
        message: v.string(),
    }),
    handler: async (ctx, args) => {
        const workIds: string[] = [];
        for (const jobId of args.jobIds) {
            const { workId } = await ctx.runMutation(api.tasks.enqueueTask as any, {
                taskType: "import",
                jobId,
                argsSummary: { jobId },
                requestedBy: "system",
            } as any);
            workIds.push(workId);
        }
        return {
            success: true,
            jobIds: workIds,
            message: `Enqueued ${args.jobIds.length} job imports`,
        };
    },
});

export const getJobs = query({
    args: {},
    returns: v.array(v.any()),
    handler: async (ctx) => {
        return await ctx.db.query("jobs").collect();
    },
});

export const getJobByTeamtailorId = query({
    args: { teamtailorId: v.string() },
    returns: v.union(v.any(), v.null()),
    handler: async (ctx, args) => {
        const job = await ctx.db
            .query("jobs")
            .withIndex("by_teamtailor_id", (q) => q.eq("teamtailorId", args.teamtailorId))
            .first();
        return job ?? null;
    },
});

export const getJobSourceDataByJobIds = query({
    args: { jobIds: v.array(v.id("jobs")) },
    returns: v.array(
        v.object({
            jobId: v.id("jobs"),
            body: v.optional(v.string()),
            links: v.optional(v.record(v.string(), v.string())),
            tags: v.optional(v.array(v.string())),
            recruiterEmail: v.optional(v.string()),
            remoteStatus: v.optional(v.string()),
            languageCode: v.optional(v.string()),
            mailbox: v.optional(v.string()),
            humanStatus: v.optional(v.string()),
            internal: v.optional(v.boolean()),
            createdAt: v.optional(v.number()),
            startDate: v.optional(v.number()),
            endDate: v.optional(v.number()),
            updatedAt: v.number(),
        })
    ),
    handler: async (ctx, args) => {
        const results: Array<any> = [];
        for (const id of args.jobIds) {
            const row = await ctx.db
                .query("jobSourceData")
                .withIndex("by_job_id", (q) => q.eq("jobId", id))
                .first();
            if (row) {
                results.push({
                    jobId: row.jobId,
                    body: row.body,
                    links: row.links,
                    tags: row.tags,
                    recruiterEmail: row.recruiterEmail,
                    remoteStatus: row.remoteStatus,
                    languageCode: row.languageCode,
                    mailbox: row.mailbox,
                    humanStatus: row.humanStatus,
                    internal: row.internal,
                    createdAt: row.createdAt,
                    startDate: row.startDate,
                    endDate: row.endDate,
                    updatedAt: row.updatedAt,
                });
            }
        }
        return results;
    },
});

// OpenAI build statuses for candidates
export const getOpenAIStatusesByCandidateIds = query({
    args: { candidateIds: v.array(v.id("candidates")) },
    returns: v.array(
        v.object({
            candidateId: v.id("candidates"),
            statuses: v.array(
                v.object({
                    workId: v.string(),
                    state: v.union(v.literal("pending"), v.literal("running"), v.literal("finished")),
                })
            ),
        })
    ),
    handler: async (ctx, args) => {
        // Load all OpenAI work ids
        const rows: Array<any> = [];
 
        const workIds: Array<string> = rows.map((r: any) => r.jobId as string);
        const statuses: any[] = [];
        const idToState: Record<string, any> = {};
        for (let i = 0; i < workIds.length; i++) idToState[workIds[i]] = statuses[i];
        const result: Array<any> = [];
        for (const cid of args.candidateIds) {
            const mine = rows.filter((r) => (r.args as any)?.candidateId === cid);
            const list = mine.map((r) => ({ workId: r.jobId as string, state: (idToState[r.jobId] as any)?.state ?? "pending" }));
            result.push({ candidateId: cid, statuses: list });
        }
        return result;
    },
});

// OpenAI build statuses for jobs
export const getOpenAIStatusesByJobIds = query({
    args: { jobIds: v.array(v.id("jobs")) },
    returns: v.array(
        v.object({
            jobId: v.id("jobs"),
            statuses: v.array(
                v.object({
                    workId: v.string(),
                    state: v.union(v.literal("pending"), v.literal("running"), v.literal("finished")),
                })
            ),
        })
    ),
    handler: async (ctx, args) => {
        const rows: Array<any> = [];
 
        const workIds: Array<string> = rows.map((r: any) => r.jobId as string);
        const statuses: any[] = [];
        const idToState: Record<string, any> = {};
        for (let i = 0; i < workIds.length; i++) idToState[workIds[i]] = statuses[i];
        const result: Array<any> = [];
        for (const jid of args.jobIds) {
            const mine = rows.filter((r) => (r.args as any)?.jobId === jid);
            const list = mine.map((r) => ({ workId: r.jobId as string, state: (idToState[r.jobId] as any)?.state ?? "pending" }));
            result.push({ jobId: jid, statuses: list });
        }
        return result;
    },
});

// Aggregated processing status for candidates
export const getProcessingStatusByCandidateIds = query({
    args: { candidateIds: v.array(v.id("candidates")) },
    returns: v.array(
        v.object({
            candidateId: v.id("candidates"),
            processed: v.boolean(),
            components: v.object({ profile: v.boolean(), embeddings: v.boolean(), sourceData: v.boolean() }),
            inProcess: v.array(v.object({ kind: v.string(), state: v.string() })),
            status: v.object({
                imported: v.boolean(),
                cv: v.boolean(),
                assessment: v.boolean(),
                hubert: v.boolean(),
                profile: v.boolean(),
                embeddings: v.boolean(),
            }),
        })
    ),
    handler: async (ctx, args) => {
        // Preload tables for components and candidate row status
        const [allProfiles, allEmbeddings, allSource, allCandidates] = await Promise.all([
            ctx.db.query("candidateProfiles").collect(),
            ctx.db.query("candidateEmbeddings").collect(),
            ctx.db.query("candidateSourceData").collect(),
            ctx.db.query("candidates").collect(),
        ]);

        // Resolve live statuses via workpools
        const openaiIds: Array<string> = [];
        const teamtailorIds: Array<string> = [];

        const [openaiStatuses, teamtailorStatuses]: any[] = [[], []];
        const idToState: Record<string, any> = {};
        for (let i = 0; i < openaiIds.length; i++) idToState[openaiIds[i]] = (openaiStatuses as any)[i];
        for (let i = 0; i < teamtailorIds.length; i++) idToState[teamtailorIds[i]] = (teamtailorStatuses as any)[i];

        const result: Array<any> = [];
        for (const cid of args.candidateIds) {
            const hasProfile = allProfiles.some((p: any) => p.candidateId === cid);
            const hasEmbeddings = allEmbeddings.some((e: any) => e.candidateId === cid);
            const sourceRow = allSource.find((s: any) => s.candidateId === cid);
            const hasSource = !!sourceRow;
            const row = allCandidates.find((c: any) => c._id === cid);
            const ps: string | undefined = row?.processingStatus;
            const inProc = ps === "profile_building"
                ? [{ kind: "buildProfile", state: "running" }]
                : ps === "embeddings_building"
                ? [{ kind: "buildCandidateEmbeddings", state: "running" }]
                : [];

            const imported = !!row;
            const cv = !!(sourceRow?.cv && (sourceRow.cv.hasCv || Object.keys(sourceRow.cv || {}).length > 0));
            const assessment = typeof sourceRow?.assessment !== "undefined" && sourceRow.assessment !== null && String(sourceRow.assessment).length > 0;
            const hubert = (!!sourceRow?.hubertOpenSummaryUrl) || (Array.isArray(sourceRow?.hubertAnswers) && sourceRow!.hubertAnswers.length > 0);

            result.push({
                candidateId: cid,
                processed: hasProfile && hasEmbeddings,
                components: { profile: hasProfile, embeddings: hasEmbeddings, sourceData: hasSource },
                inProcess: inProc,
                status: { imported, cv, assessment, hubert, profile: hasProfile, embeddings: hasEmbeddings },
            });
        }
        return result;
    },
});

// Aggregated processing status for jobs
export const getProcessingStatusByJobIds = query({
    args: { jobIds: v.array(v.id("jobs")) },
    returns: v.array(
        v.object({
            jobId: v.id("jobs"),
            processed: v.boolean(),
            components: v.object({ profile: v.boolean(), embeddings: v.boolean(), sourceData: v.boolean() }),
            inProcess: v.array(v.object({ kind: v.string(), state: v.string() })),
            status: v.object({
                imported: v.boolean(),
                cv: v.boolean(),
                assessment: v.boolean(),
                hubert: v.boolean(),
                profile: v.boolean(),
                embeddings: v.boolean(),
            }),
        })
    ),
    handler: async (ctx, args) => {
        const [allProfiles, allEmbeddings, allSource, allJobs] = await Promise.all([
            ctx.db.query("jobProfiles").collect(),
            ctx.db.query("jobEmbeddings").collect(),
            ctx.db.query("jobSourceData").collect(),
            ctx.db.query("jobs").collect(),
        ]);

        const result: Array<any> = [];
        for (const jid of args.jobIds) {
            const hasProfile = allProfiles.some((p: any) => p.jobId === jid);
            const hasEmbeddings = allEmbeddings.some((e: any) => e.jobId === jid);
            const hasSource = allSource.some((s: any) => s.jobId === jid);
            const row = allJobs.find((j: any) => j._id === jid);
            const ps: string | undefined = row?.processingStatus;
            const inProc = ps === "profile_building"
                ? [{ kind: "buildJobProfile", state: "running" }]
                : ps === "embeddings_building"
                ? [{ kind: "buildJobEmbeddings", state: "running" }]
                : [];

            const imported = !!row;
            const cv = false; // not applicable to jobs
            const assessment = false; // not applicable to jobs
            const hubert = false; // not applicable to jobs

            result.push({
                jobId: jid,
                processed: hasProfile && hasEmbeddings,
                components: { profile: hasProfile, embeddings: hasEmbeddings, sourceData: hasSource },
                inProcess: inProc,
                status: { imported, cv, assessment, hubert, profile: hasProfile, embeddings: hasEmbeddings },
            });
        }
        return result;
    },
});