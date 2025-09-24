import { action, ActionCtx, internalAction, internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { internal, api } from "./_generated/api";
import { getWorkpoolForTaskType } from "./workpools";
import { taskStatus, taskType, TaskType } from "./types";
import { Id } from "./_generated/dataModel";
import { getFunctionAddress, paginationOptsValidator } from "convex/server";
import { CandidateProfileSections } from "./tables/candidates";
import { validateCandidateProfile } from "./candidates";
import { JobProfileSections } from "./tables/jobs";
import { validateJobProfile } from "./jobs";




export async function enqueueTask(ctx: ActionCtx, type: TaskType, triggeredBy: "user" | "task" | "cron", args: any, previousTaskId?: Id<"tasks">, cronId?: string ) {

  const pool = getWorkpoolForTaskType(type);
  if (!pool) throw new Error(`No workpool found for task type: ${type}`);
  const taskRef = pool.allowedTasks.find(allowedTask => allowedTask.type === type)?.ref;
  if (!taskRef) throw new Error(`No task ref found for task type: ${type}`);

  let triggeredById = undefined;
  if(triggeredBy === "task") {
    triggeredById = previousTaskId;
  }
  if(triggeredBy === "user") {
    const user = await ctx.runQuery(api.users.current);
    if (!user) throw new Error("User not found");
    triggeredById = user._id;
  }
  if(triggeredBy === "cron") {
    triggeredById = cronId;
  }


  const taskId = await ctx.runMutation(internal.tasks.createTask, { type, workpool: pool.name, status: "queued", queuedAt: Date.now(), args: args, triggeredBy, triggeredById});

  const workId = await pool.enqueueAction(ctx, taskRef, { taskId, ...args, });

  return { taskId, workId };
}

export async function enqueueTaskRerun(ctx: ActionCtx, taskId: Id<"tasks">) {
  const task = await ctx.runQuery(api.tasks.get, { taskId });

  if (!task) throw new Error("Task not found");
  const pool = getWorkpoolForTaskType(task.type as TaskType);
  if (!pool) throw new Error("No pool found for task type: " + task.type);

  const taskRef = pool.allowedTasks.find(allowedTask => allowedTask.type === task.type)?.ref;
  if (!taskRef) throw new Error("No task ref found for task type: " + task.type);

  const user = await ctx.runQuery(api.users.current);
  if (!user) throw new Error("User not found");

  await ctx.runMutation(internal.tasks.updateTask, { taskId, status: "queued", queuedAt: Date.now(), errorMessage: "", progress: 0, progressMessage: "", runAt: undefined, stoppedAt: undefined, attempts: task.attempts + 1, metadata: {}, triggeredBy: "user", triggeredById: user._id,});
  const workId = await pool.enqueueAction(ctx, taskRef, { taskId, ...task.args, });

  return { taskId, workId };
}

//INTERNAL
  export const createTask = internalMutation({
  args: {
    type: taskType,
    workpool: v.string(),
    status: taskStatus,
    queuedAt: v.number(),
    triggeredBy: v.union(v.literal("user"), v.literal("task"), v.literal("cron")),
    triggeredById: v.optional(v.union(v.id("users"), v.id("tasks"), v.string())),
    args: v.any(),
  },
  handler: async (ctx, args) => {
    const { type, workpool, status, queuedAt, triggeredBy, triggeredById } = args;
    const taskId = await ctx.db.insert("tasks", {
      workpool,
      type,
      triggeredBy,
      triggeredById,
      args: args.args,
      status,
      queuedAt,
      attempts: 1,
      progress: 0,
      progressMessages: [],
      errorMessage: "",
    });
    return taskId;
  },
});




export const updateTask = internalMutation({
  args: {
    taskId: v.id("tasks"),
    status: taskStatus,
    queuedAt: v.optional(v.number()),
    triggeredBy: v.optional(v.union(v.literal("user"), v.literal("task"), v.literal("cron"), v.literal("system"))),
    triggeredById: v.optional(v.union(v.id("users"), v.id("tasks"))),
    runAt: v.optional(v.number()),
    stoppedAt: v.optional(v.number()),
    progress: v.optional(v.number()),
    progressMessage: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    attempts: v.optional(v.number()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const { taskId, status, progressMessage, stoppedAt, ...optionalFields } = args;
    const task = await ctx.db.get(taskId);
    if (!task) throw new Error("Task not found");

    const progressMessages = progressMessage 
      ? [...task.progressMessages, { message: progressMessage, timestamp: Date.now() }]
      : task.progressMessages;


    const updateData = Object.fromEntries(
      Object.entries({ status, ...optionalFields }).filter(([_, value]) => value !== undefined)
    );


    await ctx.db.patch(taskId, { ...updateData, progressMessages, stoppedAt });
  },
});

//TASKS

export const task_tt_sync = internalAction({
  args: {
    taskId: v.id("tasks"),
    updatedAt: v.optional(v.number()),
    timeAgo: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { taskId, updatedAt, timeAgo } = args;
    if(!updatedAt && !timeAgo) throw new Error("Updated at or time ago is required");
    //set task to running
    await ctx.runMutation(internal.tasks.updateTask, { taskId, status: "running", runAt: Date.now(), progress: 0 });
    //get candidates by updated at
    try {
    const candidates = await ctx.runAction(internal.teamtailor.getCandidatesByUpdatedTT, { updatedAtTT: updatedAt || Date.now() - timeAgo!});
    
    await ctx.runMutation(internal.tasks.updateTask, { taskId, status: "running", progress: 0, progressMessage: "Syncing " + candidates.length + " candidates from Teamtailor" });
    let progress = 0

    for (let i = 0; i < candidates.length; i++) {
     
      const candidate = candidates[i];
      const assessment = await ctx.runAction(internal.teamtailor.fetchCandidateAssesment, { teamtailorId: candidate.id });
      const hubertAnswers = await ctx.runAction(internal.hubert.fetchHubert, { teamtailorId: candidate.id });
      const resumeSummary = candidate.attributes["resume-summary"];
      const linkedinSummary = candidate.attributes["linkedin-profile"];
      await ctx.runMutation(internal.teamtailor.upsertCandidateTTCacheRow , {
        teamtailorId: candidate.id,
        name: candidate.attributes["first-name"] + " " + candidate.attributes["last-name"],
        email: candidate.attributes.email,
        hasAssessment: assessment ? true : false,
        hasHubert: hubertAnswers ? true : false,
        hasResumeSummary: resumeSummary ? true : false,
        hasLinkedinSummary: linkedinSummary ? true : false,
        updatedAt: Date.parse(candidate.attributes["updated-at"]),
        createdAt: Date.parse(candidate.attributes["created-at"]),
      });

      progress = Math.round(i * (50 / candidates.length));
      await ctx.runMutation(internal.tasks.updateTask, { taskId, status: "running", progress });

      // Add a small delay between candidates to avoid rate limiting
      if (i < candidates.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
      }
  }
  } catch (error) {
    await ctx.runMutation(internal.tasks.updateTask, { taskId, status: "failed", stoppedAt: Date.now(), errorMessage: error instanceof Error ? error.message : "Unknown error occurred when syncing candidates" });
    return { success: false, message: "Sync failed" };
  }

  try {
    const jobs = await ctx.runAction(internal.teamtailor.getJobsByUpdatedTT, { updatedAtTT: updatedAt || Date.now() - timeAgo!});
    await ctx.runMutation(internal.tasks.updateTask, { taskId, status: "running", progress: 50, progressMessage: "Syncing " + jobs.length + " jobs from Teamtailor" });
    let progress = 50;
    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];
      await ctx.runMutation(internal.teamtailor.upsertJobTTCacheRow, { teamtailorId: job.id, updatedAt: Date.parse(job.attributes["updated-at"]), createdAt: Date.parse(job.attributes["created-at"]), title: job.attributes.title, body: job.attributes.body });



      progress = 50 + Math.round(i * (50 / jobs.length));
      await ctx.runMutation(internal.tasks.updateTask, { taskId, status: "running", progress });
    }
  


    } catch (error) {
      await ctx.runMutation(internal.tasks.updateTask, { taskId, status: "failed", stoppedAt: Date.now(), errorMessage: error instanceof Error ? error.message : "Unknown error occurred when syncing jobs" });
      return { success: false, message: "Sync failed" };
    }

    await ctx.runMutation(internal.tasks.updateTask, { taskId, status: "succeeded", stoppedAt: Date.now(), progress: 100, progressMessage: "Sync complete" });
    return { success: true, message: "Sync complete" };
  },
});

export const task_tt_import = internalAction({
  args: {
    taskId: v.id("tasks"),
    teamtailorId: v.string(),
    type: v.union(v.literal("candidate"), v.literal("job")),
  },
  handler: async (ctx, args) => {
    const { taskId, teamtailorId, type } = args;
    //set task to running
    await ctx.runMutation(internal.tasks.updateTask, { taskId, status: "running", runAt: Date.now() });


    if (type === "candidate") {
      try {
        //Step 1: import candidate
        const candidate = await ctx.runAction(internal.teamtailor.importCandidate, { teamtailorId });
        await ctx.runMutation(internal.tasks.updateTask, { taskId, status: "running", progress: 10, progressMessage: "Candidate with id " + teamtailorId + " imported" });


        //Step 2: create candidate record
        const candidateId = await ctx.runMutation(internal.candidates.create, {
          teamtailorId: teamtailorId,
          name: candidate.name,
          imageUrl: candidate.imageUrl,
          email: candidate.email,
          linkedinUrl: candidate.linkedinUrl,
          rawData: candidate,
          processingTask: taskId,
          updatedAtTT: candidate.updatedAtTT,
          createdAtTT: candidate.createdAtTT,

        });
        await ctx.runMutation(internal.tasks.updateTask, { taskId, status: "running", progress: 30, progressMessage: "Candidate with id " + teamtailorId + " created" });

        //Step 3: fetch assesment
        const assesment = await ctx.runAction(internal.teamtailor.fetchCandidateAssesment, { teamtailorId });
        await ctx.runMutation(internal.tasks.updateTask, { taskId, status: "running", progress: 50, progressMessage: "Fetched assesment for candidate with id " + teamtailorId });

        //Step 4: fetch hubert answers
        const { hubertUrl, hubertAnswers } = await ctx.runAction(internal.hubert.fetchHubert, { teamtailorId });
        await ctx.runMutation(internal.tasks.updateTask, { taskId, status: "running", progress: 70, progressMessage: "Fetched hubert answers for candidate with id " + teamtailorId });

        //Step 5: create candidate source data
        await ctx.runMutation(internal.candidates.upsertSourceData, {
          candidateId: candidateId,
          assessment: assesment,
          hubertAnswers: hubertAnswers,
          hubertUrl: hubertUrl,
          resumeSummary: candidate.resumeSummary,   //From Teamtailor
          linkedinSummary: candidate.linkedinSummary,   //From Teamtailor
        });
        await ctx.runMutation(internal.tasks.updateTask, { taskId, status: "running", progress: 90, progressMessage: "Created candidate source data for candidate with id " + teamtailorId });

        //Step 6: enqueue build profile task
        await enqueueTask(ctx, "build_profile", "task", { type: "candidate", id: candidateId }, taskId);
        await ctx.runMutation(internal.tasks.updateTask, { taskId, status: "succeeded", stoppedAt: Date.now(), progress: 100, progressMessage: "Queued build profile task for candidate with id " + teamtailorId });


        return { success: true, message: "Candidate with id " + teamtailorId + " imported" };

      } catch (error) {
        await ctx.runMutation(internal.tasks.updateTask, { taskId, status: "failed", stoppedAt: Date.now(), errorMessage: error instanceof Error ? error.message : "Unknown error occurred when importing candidate" });
        return { success: false, message: "Candidate with id " + teamtailorId + "could not be imported" };
      }

    }

    if (type === "job") {
      try {
        //Step 1: import job
        const job = await ctx.runAction(internal.teamtailor.importJob, { teamtailorId });
        await ctx.runMutation(internal.tasks.updateTask, { taskId, status: "running", progress: 10, progressMessage: "Job with id " + teamtailorId + " imported" });

        //TOD: what if the job has no company name?
        //Step 2: connect or create company
        const companyId = await ctx.runMutation(internal.companies.connectOrCreate, { name: job.companyName });
        await ctx.runMutation(internal.tasks.updateTask, { taskId, status: "running", progress: 30, progressMessage: "Connected or created company with id " + companyId });

        //Step 2: create job record
        const jobId = await ctx.runMutation(internal.jobs.create, {
          teamtailorId,
          teamtailorTitle: job.teamtailorTitle,
          companyId,
          title: job.title,
          orderNumber: job.orderNumber,
          rawData: job.rawData,
          processingTask: taskId,
          updatedAtTT: job.updatedAtTT,
          createdAtTT: job.createdAtTT,

        });
        await ctx.runMutation(internal.tasks.updateTask, { taskId, status: "running", progress: 50, progressMessage: "Job with id " + teamtailorId + " created" });

        //Step 3: upsert job source data
        await ctx.runMutation(internal.jobs.upsertSourceData, {
          jobId,
          teamtailorBody: job.body,
        });
        await ctx.runMutation(internal.tasks.updateTask, { taskId, status: "running", progress: 75, progressMessage: "Upserted job source data for job with id " + teamtailorId });
        //Step 3: enqueue build profile task
        await enqueueTask(ctx, "build_profile", "task", { type: "job", id: jobId }, taskId);
        await ctx.runMutation(internal.tasks.updateTask, { taskId, status: "succeeded", progress: 100, progressMessage: "Queued build profile task for job with id " + teamtailorId });
        return { success: true, message: "Job with id " + teamtailorId + " imported" };
      } catch (error) {
        await ctx.runMutation(internal.tasks.updateTask, { taskId, status: "failed", stoppedAt: Date.now(), errorMessage: error instanceof Error ? error.message : "Unknown error occurred when importing job" });
        return { success: false, message: "Job with id " + teamtailorId + "could not be imported" };
      }
    }
    return { success: false, message: "Invalid type" };

  }
});



export const task_build_profile = internalAction({
  args: {
    taskId: v.id("tasks"),
    type: v.union(v.literal("candidate"), v.literal("job")),
    id: v.union(v.id("candidates"), v.id("jobs")),
  },
  handler: async (ctx, args) => {
    const { taskId, type, id } = args;
    //set task to running
    await ctx.runMutation(internal.tasks.updateTask, { taskId, status: "running", runAt: Date.now() });

    if (type === "candidate") {
      try {
        const candidateId = id as Id<"candidates">;
        //update candidate processing task
        await ctx.runMutation(internal.candidates.setProcessingTask, { candidateId, processingTask: taskId });
        //Step 1: query candidate source data
        const candidateSourceData = await ctx.runQuery(api.candidates.getSourceData, { candidateId });
        await ctx.runMutation(internal.tasks.updateTask, { taskId, status: "running", progress: 25, progressMessage: "Queried candidate source data" });
        //Step 2: build candidate profile
        const { profile, raw, metadata } = await ctx.runAction(internal.openai.buildCandidateProfile, { assessment: candidateSourceData?.assessment, hubertAnswers: candidateSourceData?.hubertAnswers, resumeSummary: candidateSourceData?.resumeSummary, linkedinSummary: candidateSourceData?.linkedinSummary });
        await ctx.runMutation(internal.tasks.updateTask, { taskId, status: "running", progress: 50, progressMessage: "Built candidate profile", metadata: metadata });


        //Step 3: upsert candidate profile
        await ctx.runMutation(internal.candidates.upsertProfile, {
          candidateId,
          raw,
          metadata,
          summary: profile.summary,
          description: profile.description,
          education: profile.education,
          workExperience: profile.workExperience,
          preferences: profile.preferences,
          aspirations: profile.aspirations,
          technicalSkills: profile.technicalSkills,
          softSkills: profile.softSkills,
        });
        await ctx.runMutation(internal.tasks.updateTask, { taskId, status: "running", progress: 75, progressMessage: "Upserted candidate profile" });
        //Step 4: enqueue embed profile task
        await enqueueTask(ctx, "embed_profile", "task", { type: "candidate", id: candidateId }, taskId);
        await ctx.runMutation(internal.tasks.updateTask, { taskId, status: "succeeded", progress: 100, stoppedAt: Date.now(), progressMessage: "Queued embed profile task for candidate with id " + id });

      } catch (error) {
        //add args to error message
        await ctx.runMutation(internal.tasks.updateTask, { taskId, status: "failed", stoppedAt: Date.now(), errorMessage: error instanceof Error ? error.message : "Unknown error occurred when building candidate profile" });
        return { success: false, message: "Candidate profile with id " + id + "could not be built" };
      }



    }

    if (type === "job") {
      try {
        const jobId = id as Id<"jobs">;
        //update job processing task
        await ctx.runMutation(internal.jobs.setProcessingTask, { jobId, processingTask: taskId });

        //Step 1: query job source data
        const jobSourceData = await ctx.runQuery(api.jobs.getSourceData, { jobId });
        await ctx.runMutation(internal.tasks.updateTask, { taskId, status: "running", progress: 25, progressMessage: "Queried job source data" });

        //Step 2: build job profile
        const { profile, raw, metadata } = await ctx.runAction(internal.openai.buildJobProfile, { teamTailorBody: jobSourceData?.teamtailorBody });
        await ctx.runMutation(internal.tasks.updateTask, { taskId, status: "running", progress: 50, progressMessage: "Built job profile", metadata: metadata });

        //Step 3: upsert job profile
        await ctx.runMutation(internal.jobs.upsertProfile, {
          jobId,
          raw,
          metadata,
          summary: profile.summary,
          education: profile.education,
          workTasks: profile.workTasks,
          preferences: profile.preferences,
          aspirations: profile.aspirations,
          technicalSkills: profile.technicalSkills,
          softSkills: profile.softSkills,
        });
        await ctx.runMutation(internal.tasks.updateTask, { taskId, status: "running", progress: 75, progressMessage: "Upserted job profile" });
        
        //Step 4: enqueue embed profile task
        await enqueueTask(ctx, "embed_profile", "task", { type: "job", id: jobId }, taskId);
        await ctx.runMutation(internal.tasks.updateTask, { taskId, status: "succeeded", progress: 100, stoppedAt: Date.now(), progressMessage: "Queued embed profile task for job with id " + id });

      } catch (error) {
        await ctx.runMutation(internal.tasks.updateTask, { taskId, status: "failed", stoppedAt: Date.now(), errorMessage: error instanceof Error ? error.message : "Unknown error occurred when building job profile" });
        return { success: false, message: "Job profile with id " + id + "could not be built" };
      }
      }
    }
  
});




export const task_embed_profile = internalAction({
  args: {
    taskId: v.id("tasks"),
    type: v.union(v.literal("candidate"), v.literal("job")),
    id: v.union(v.id("candidates"), v.id("jobs")),
  },
  handler: async (ctx, args) => {
    const { taskId, type, id } = args;
    //set task to running
    await ctx.runMutation(internal.tasks.updateTask, { taskId, status: "running", runAt: Date.now() });

    if (type === "candidate") {
      try {
        const candidateId = id as Id<"candidates">;
        //update candidate processing task
        await ctx.runMutation(internal.candidates.setProcessingTask, { candidateId, processingTask: taskId });

        //Step 1: query candidate profile
        const candidateProfile = await ctx.runQuery(api.candidates.getProfile, { candidateId });
        if (!candidateProfile) throw new Error("Candidate profile not found");
        await ctx.runMutation(internal.tasks.updateTask, { taskId, status: "running", progress: 25, progressMessage: "Queried candidate profile" });

        //Step2: check if all fields are present
        validateCandidateProfile(candidateProfile);
        await ctx.runMutation(internal.tasks.updateTask, { taskId, status: "running", progress: 50, progressMessage: "Validated candidate profile" });
     
        //Step 3: embed candidate profile
        const textsToEmbed = [
          candidateProfile.summary,
          candidateProfile.technicalSkills.map((skill) => skill.name).join(", "),
          candidateProfile.softSkills.map((skill) => skill.name).join(", "),
          candidateProfile.education.join(". "), // Use period separation for better semantic parsing
          candidateProfile.workExperience.join(". "), // Use period separation for better semantic parsing
          candidateProfile.preferences.join(", "),
          candidateProfile.aspirations.join(", ")
        ];
        
        const { embeddings, metadata } = await ctx.runAction(internal.openai.embedMany, { texts: textsToEmbed });
        await ctx.runMutation(internal.tasks.updateTask, { taskId, status: "running", progress: 75, progressMessage: "Embedded candidate profile", metadata });

        //Step 4: enqueue candidate embeddings
        const sections : CandidateProfileSections[] = ["summary", "technical_skills", "soft_skills", "education", "work_experience", "preferences", "aspirations"];
        const embeddingPromises = embeddings.map((embedding, index) => 
          ctx.runMutation(internal.candidates.upsertEmbedding, { 
            candidateId, 
            vector: embedding, 
            section: sections[index], 
            metadata: metadata
          })
        );
        
        await Promise.all(embeddingPromises);

        await ctx.runMutation(internal.tasks.updateTask, { taskId, status: "succeeded", progress: 100, stoppedAt: Date.now(), progressMessage: "Created candidate embeddings" });
        return { success: true, message: "Candidate profile with id " + id + "embedded" };
      } catch (error) {
        await ctx.runMutation(internal.tasks.updateTask, { taskId, status: "failed", stoppedAt: Date.now(), errorMessage: error instanceof Error ? error.message : "Unknown error occurred when embedding candidate profile" });
        return { success: false, message: "Candidate profile with id " + id + "could not be embedded" };
      }

    }

    if (type === "job") {
      try {
        const jobId = id as Id<"jobs">;
        //update job processing task
        await ctx.runMutation(internal.jobs.setProcessingTask, { jobId, processingTask: taskId });

        //Step 1: query job profile
        const jobProfile = await ctx.runQuery(api.jobs.getProfile, { jobId });
        if (!jobProfile) throw new Error("Job profile not found");
        await ctx.runMutation(internal.tasks.updateTask, { taskId, status: "running", progress: 25, progressMessage: "Queried job profile" });
        
        //Step 2: check if all fields are present
        validateJobProfile(jobProfile);
        await ctx.runMutation(internal.tasks.updateTask, { taskId, status: "running", progress: 50, progressMessage: "Validated job profile" });
        
        //Step 3: embed job profile
        const textsToEmbed = [
          jobProfile.summary,
          jobProfile.technicalSkills.map((skill) => skill.name).join(", "),
          jobProfile.softSkills.map((skill) => skill.name).join(", "),
          jobProfile.education.join(". "), // Use period separation for better semantic parsing
          jobProfile.workTasks.join(". "), // Use period separation for better semantic parsing
          jobProfile.preferences.join(", "),
          jobProfile.aspirations.join(", ")
        ];

        const { embeddings, metadata } = await ctx.runAction(internal.openai.embedMany, { texts: textsToEmbed });
        await ctx.runMutation(internal.tasks.updateTask, { taskId, status: "running", progress: 75, progressMessage: "Embedded job profile", metadata });

        //Step 4: enqueue job embeddings
        const sections : JobProfileSections[] = ["summary", "technical_skills", "soft_skills", "education", "work_tasks", "preferences", "aspirations"];
        const embeddingPromises = embeddings.map((embedding, index) => 
        ctx.runMutation(internal.jobs.upsertEmbedding, { jobId, vector: embedding, section: sections[index], metadata: metadata })
        );
        await Promise.all(embeddingPromises);

        await ctx.runMutation(internal.tasks.updateTask, { taskId, status: "succeeded", progress: 100, stoppedAt: Date.now(), progressMessage: "Created job embeddings" });
        return { success: true, message: "Job profile with id " + id + "embedded" };
      } catch (error) {
        await ctx.runMutation(internal.tasks.updateTask, { taskId, status: "failed", stoppedAt: Date.now(), errorMessage: error instanceof Error ? error.message : "Unknown error occurred when embedding job profile" });
        return { success: false, message: "Job profile with id " + id + "could not be embedded" };
      }
    }
  }
});





export const task_match = internalAction({
  args: {
    taskId: v.id("tasks"),
    candidateId: v.id("candidates"),
    jobId: v.id("jobs"),
    model: v.string(),
    scoringGuidelineId: v.id("scoringGuidelines"),
  },
  handler: async (ctx, args) => {
    const { taskId, candidateId, jobId, model, scoringGuidelineId } = args;

    //set task to running
    await ctx.runMutation(internal.tasks.updateTask, { taskId, status: "running", runAt: Date.now() });

    try {

    //update processing task
    await ctx.runMutation(internal.candidates.setProcessingTask, { candidateId, processingTask: taskId });
    await ctx.runMutation(internal.jobs.setProcessingTask, { jobId, processingTask: taskId });

    //Step 1: query profiles
    const candidateProfile = await ctx.runQuery(api.candidates.getProfile, { candidateId });
    if (!candidateProfile) throw new Error("Candidate profile not found");
    const jobProfile = await ctx.runQuery(api.jobs.getProfile, { jobId });
    if (!jobProfile) throw new Error("Job profile not found");

    await ctx.runMutation(internal.tasks.updateTask, { taskId, status: "running", progress: 25, progressMessage: "Queried profiles" });


    //Step 2: fetch scoring guidelines
    const scoringGuidelines = await ctx.runQuery(api.scoringGuidelines.get, { scoringGuidelineId });
    if (!scoringGuidelines) throw new Error("Scoring guidelines not found");
    await ctx.runMutation(internal.tasks.updateTask, { taskId, status: "running", progress: 35, progressMessage: "Queried scoring guidelines" });

    //Step 3: match
    const { response, metadata } = await ctx.runAction(internal.matches.match, { candidateProfile: candidateProfile, jobProfile: jobProfile, scoringGuidelines: scoringGuidelines.text, model });

    await ctx.runMutation(internal.tasks.updateTask, { taskId, status: "running", progress: 50, progressMessage: "Fetching match", metadata: metadata });

    //Step 4: create match
    await ctx.runMutation(internal.matches.create, {
      candidateId: candidateId,
      jobId: jobId,
      model,
      score: response.score,
      explanation: response.explanation,
      scoringGuidelineId: scoringGuidelineId,
      metadata: metadata,
    });

    await ctx.runMutation(internal.tasks.updateTask, { taskId, status: "succeeded", progress: 100, stoppedAt: Date.now(), progressMessage: "Created match" });
    return { success: true, message: "Match created" };
    } catch (error) {
      await ctx.runMutation(internal.tasks.updateTask, { taskId, status: "failed", stoppedAt: Date.now(), errorMessage: error instanceof Error ? error.message : "Unknown error occurred when creating match" });
      return { success: false, message: "Match could not be created" };
    }
    



  }
});





//API

export const listPaginated = query({
  args: {
    paginationOpts: paginationOptsValidator,
    workpool: v.optional(v.string()),
    status: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const { paginationOpts, workpool, status } = args;
    
    // Apply workpool filter if specified
    if (workpool && workpool !== "all") {
      const query = ctx.db.query("tasks").withIndex("by_workpool_and_status", (q) => 
        q.eq("workpool", workpool)
      );
      
      // Apply status filter if specified and not all statuses
      if (status && status.length > 0 && status.length < 5) { // 5 is the total number of statuses
        const filteredQuery = query.filter((q) => 
          q.or(...status.map(s => q.eq(q.field("status"), s)))
        );
        return await filteredQuery.order("desc").paginate(paginationOpts);
      }
      
      return await query.order("desc").paginate(paginationOpts);
    }
    
    // No workpool filter - apply only status filter if specified
    if (status && status.length > 0 && status.length < 5) {
      const query = ctx.db.query("tasks").filter((q) => 
        q.or(...status.map(s => q.eq(q.field("status"), s)))
      );
      return await query.order("desc").paginate(paginationOpts);
    }
    
    // No filters - return all tasks
    return await ctx.db.query("tasks").order("desc").paginate(paginationOpts);
  },
});


export const get = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.taskId);
  },
});

export const getTasksCount = query({
  handler: async (ctx) => {
    return (await ctx.db.query("tasks").collect()).length;
  },
});

export const getFilteredTasksCount = query({
  args: {
    workpool: v.optional(v.string()),
    status: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const { workpool, status } = args;
    
    // Apply workpool filter if specified
    if (workpool && workpool !== "all") {
      const query = ctx.db.query("tasks").withIndex("by_workpool_and_status", (q) => 
        q.eq("workpool", workpool)
      );
      
      // Apply status filter if specified and not all statuses
      if (status && status.length > 0 && status.length < 5) { // 5 is the total number of statuses
        const filteredQuery = query.filter((q) => 
          q.or(...status.map(s => q.eq(q.field("status"), s)))
        );
        return (await filteredQuery.collect()).length;
      }
      
      return (await query.collect()).length;
    }
    
    // No workpool filter - apply only status filter if specified
    if (status && status.length > 0 && status.length < 5) {
      const query = ctx.db.query("tasks").filter((q) => 
        q.or(...status.map(s => q.eq(q.field("status"), s)))
      );
      return (await query.collect()).length;
    }
    
    // No filters - return all tasks count
    return (await ctx.db.query("tasks").collect()).length;
  },
});


export const runTask = action({
  args: {
    taskType: taskType,
    args: v.any(),
    triggeredBy: v.union(v.literal("user"), v.literal("task"), v.literal("cron")),
    triggeredById: v.optional(v.union(v.id("users"), v.id("tasks"), v.string())),
  },
  handler: async (ctx, args) => {
    try {
      if(args.triggeredBy === "cron") {
        await enqueueTask(ctx, args.taskType, args.triggeredBy, args.args, undefined, args.triggeredById as string);
      } else {
        await enqueueTask(ctx, args.taskType, args.triggeredBy, args.args);
      }
    return { success: true, message: "Task queued" };
    } catch (error) {
      console.error(error);
      return { success: false, message: "Task could not be queued" };
    }
  },
});


export const rerunTask = action({
  args: {
    taskId: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    try {
      await enqueueTaskRerun(ctx, args.taskId);
      return { success: true, message: "Task queued for rerun" };
    } catch (error) {
      console.error(error);
      return { success: false, message: "Task could not be queued for rerun" };
    }
  },
});