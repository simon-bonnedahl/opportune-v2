import { action, ActionCtx, internalAction, internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { internal, api } from "./_generated/api";
import { getWorkpoolForTaskType } from "./workpools";
import { taskStatus, taskType, TaskType } from "./types";
import { Id } from "./_generated/dataModel";
import { paginationOptsValidator } from "convex/server";
import { CandidateProfileSections } from "./tables/candidates";
import { validateCandidateProfile } from "./candidates";




export async function enqueueTask(ctx: ActionCtx, type: TaskType, triggeredBy: "user" | "task" | "cron" | "system", args: any, previousTaskId?: Id<"tasks"> ) {

  const pool = getWorkpoolForTaskType(type);
  if (!pool) throw new Error(`No workpool found for task type: ${type}`);
  const taskRef = pool.allowedTasks.find(task => task.type === type)?.ref;
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


  const taskId = await ctx.runMutation(internal.tasks.createTask, { type, workpool: pool.name, status: "queued", queuedAt: Date.now(), args: args, triggeredBy, triggeredById});

  const workId = await pool.enqueueAction(ctx, taskRef, { taskId, ...args, });

  return { taskId, workId };
}

export async function enqueueTaskRerun(ctx: ActionCtx, taskId: Id<"tasks">) {
  const task = await ctx.runQuery(api.tasks.get, { taskId });

  if (!task) throw new Error("Task not found");
  const pool = getWorkpoolForTaskType(task.type as TaskType);
  if (!pool) throw new Error("No pool found for task type: " + task.type);
  const taskRef = pool.allowedTasks.find(task => task.type === task.type)?.ref;
  if (!taskRef) throw new Error("No task ref found for task type: " + task.type);

  const user = await ctx.runQuery(api.users.current);
  if (!user) throw new Error("User not found");

  await ctx.runMutation(internal.tasks.updateTask, { taskId, status: "queued", queuedAt: Date.now(), errorMessage: "", progress: 0, progressMessage: "", runAt: undefined, stoppedAt: undefined, attempts: task.attempts + 1, metadata: undefined, triggeredBy: "user", triggeredById: user._id});
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
    triggeredBy: v.union(v.literal("user"), v.literal("task"), v.literal("cron"), v.literal("system")),
    triggeredById: v.optional(v.union(v.id("users"), v.id("tasks"))),
    args: v.any(),
  },
  handler: async (ctx, args) => {
    const { type, workpool, status, queuedAt, triggeredBy } = args;
    const taskId = await ctx.db.insert("tasks", {
      workpool,
      type,
      triggeredBy,
      triggeredById: args.triggeredById,
      args: args.args,
      status,
      queuedAt,
      attempts: 1,
      progress: 0,
      progressMessage: "",
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
    const { taskId, status, ...optionalFields } = args;

    const updateData = Object.fromEntries(
      Object.entries({ status, ...optionalFields }).filter(([_, value]) => value !== undefined)
    );

    await ctx.db.patch(taskId, updateData);
  },
});

//TASKS
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
        //Step 2: create job record
        const jobId = await ctx.runMutation(internal.jobs.createJob, {
          teamtailorId,
          title: job.title,
          location: job.location,

          rawData: job.rawData,
          processingTask: taskId,
          updatedAtTT: job.updatedAtTT,
          createdAtTT: job.createdAtTT,

        });
        await ctx.runMutation(internal.tasks.updateTask, { taskId, status: "running", progress: 50, progressMessage: "Job with id " + teamtailorId + " created" });
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

        //debug print profile
        console.log("profile", profile);
        console.log("raw", raw);

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
          candidateProfile.education.join(", "),
          candidateProfile.workExperience.join(", "),
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
  }








});


export const task_match = internalAction({
  args: {
    taskId: v.id("tasks"),
    candidateId: v.optional(v.string()),
    jobId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { taskId, candidateId, jobId } = args;
    //set task to running
    await ctx.runMutation(internal.tasks.updateTask, { taskId, status: "running", runAt: Date.now() });



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



export const rerunTask = action({
  args: {
    taskId: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    await enqueueTaskRerun(ctx, args.taskId);
    return { success: true, message: "Task rerunned" };
  },
});