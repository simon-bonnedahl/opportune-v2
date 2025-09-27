import { action, httpAction, internalMutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { enqueueTask } from "./tasks";
import { api, internal } from "./_generated/api";
import { paginationOptsValidator } from "convex/server";
import { candidateProfileSections } from "./tables/candidates";
import { jobProfileSections } from "./tables/jobs";

//Helpers
export function validateJobProfile(profile: any): void {
  const emptyFields = [];
  
  // Check string fields
  if (!profile.summary || profile.summary.trim().length === 0) {
    emptyFields.push("summary");
  }
  
  // Check array fields
  if (!profile.technicalSkills || profile.technicalSkills.length === 0) {
    emptyFields.push("technicalSkills");
  }
  
  if (!profile.softSkills || profile.softSkills.length === 0) {
    emptyFields.push("softSkills");
  }
  
  if (!profile.education || profile.education.length === 0) {
    emptyFields.push("education");
  }
  
  if (!profile.workTasks || profile.workTasks.length === 0) {
    emptyFields.push("workExperience");
  }
  
  if (!profile.preferences || profile.preferences.length === 0) {
    emptyFields.push("preferences");
  }
  
  if (!profile.aspirations || profile.aspirations.length === 0) {
    emptyFields.push("aspirations");
  }
  
  if (emptyFields.length > 0) {
    throw new Error(`Couldnt embed job profile. Missing or empty fields: ${emptyFields.join(", ")}`);
  }
}

//Internal
export const create = internalMutation({
  args: {
    teamtailorId: v.optional(v.string()), 
    teamtailorTitle: v.optional(v.string()),
    title: v.optional(v.string()),
    companyId: v.optional(v.id("companies")),
    orderNumber: v.optional(v.string()),
    type: v.optional(v.union(v.literal("order"), v.literal("lead"), v.literal("prospect"))),
    recruiters: v.array(v.id("users")),
    salesRepresentatives: v.array(v.id("users")),
    locations: v.optional(v.array(v.string())),
    rawData: v.any(),
    processingTask: v.optional(v.id("tasks")),
    updatedAtTT: v.optional(v.number()),
    createdAtTT: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existingJob = await ctx.db
      .query("jobs")
      .withIndex("by_teamtailor_id", (q) => q.eq("teamtailorId", args.teamtailorId))
      .first();
    
    if(existingJob) 
      throw new Error("Job already exists with teamtailor id " + args.teamtailorId);
   
    const jobId = await ctx.db.insert("jobs", {
      teamtailorId: args.teamtailorId,
      teamtailorTitle: args.teamtailorTitle,
      title: args.title,
      companyId: args.companyId,
      locations: args.locations ?? [],  
      orderNumber: args.orderNumber,
      type: args.type,
      recruiters: args.recruiters,
      salesRepresentatives: args.salesRepresentatives,
      rawData: args.rawData,
      processingTask: args.processingTask,
      updatedAt: Date.now(),
      updatedAtTT: args.updatedAtTT,
      createdAtTT: args.createdAtTT,
    } );
    return jobId;
  },
});
export const upsertProfile = internalMutation({
  args: {
    jobId: v.id("jobs"),
    summary: v.string(),
    raw: v.string(),
    metadata: v.any(),
    education: v.array(v.string()),
    workTasks: v.array(v.string()),
    preferences: v.array(v.string()),
    aspirations: v.array(v.string()),
    technicalSkills: v.array(

      v.object({
        name: v.string(),
        score: v.number(),
      })

    ),
    softSkills: v.array(v.string()),
  },
  handler: async (ctx, args) => {

    const existing = await ctx.db
      .query("jobProfiles")
      .withIndex("by_job_id", (q) => q.eq("jobId", args.jobId))
      .first();

    const { jobId, ...rest } = args;
    if (existing) { //TODO: is this needed?
      const updateData = Object.fromEntries(
        Object.entries({ ...rest }).filter(([_, value]) => value.length > 0)
      );

      await ctx.db.patch(args.jobId, {...updateData, updatedAt: Date.now()});
      return existing._id;
    }

    return await ctx.db.insert("jobProfiles", {
      jobId: args.jobId,
      summary: args.summary,
      raw: args.raw,
      metadata: args.metadata,
      education: args.education,
      technicalSkills: args.technicalSkills,
      softSkills: args.softSkills,
      workTasks: args.workTasks,
      preferences: args.preferences,
      aspirations: args.aspirations,
      updatedAt: Date.now(),
    });
  },
});




export const upsertSourceData = internalMutation({
  args: {
    jobId: v.id("jobs"),
    teamtailorBody: v.optional(v.any()),
    body: v.optional(v.any()),
  },
  returns: v.union(v.id("jobSourceData"), v.null()),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("jobSourceData")
      .withIndex("by_job_id", (q) => q.eq("jobId", args.jobId))
      .first();
    const doc = {
      teamtailorBody: args.teamtailorBody,
      body: args.body,
      updatedAt: Date.now(),
    };
    if (existing) {
      await ctx.db.patch(existing._id, doc);
      return existing._id;
    }
    return await ctx.db.insert("jobSourceData", { jobId: args.jobId, ...doc });
  },
});

export const setProcessingTask = internalMutation({
  args: { jobId: v.id("jobs"), processingTask: v.id("tasks") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, { processingTask: args.processingTask });
  },
});

export const upsertEmbedding = internalMutation({
  args: { jobId: v.id("jobs"), vector: v.array(v.number()), section: jobProfileSections, metadata: v.optional(v.any()) },
  handler: async (ctx, args) => {
    //update if exists - query by both candidateId and section to avoid race conditions
    const existing = await ctx.db.query("jobEmbeddings").withIndex("by_job_id_and_section", (q) => 
      q.eq("jobId", args.jobId).eq("section", args.section)
    ).first();
    
    if (existing) {
      await ctx.db.patch(existing._id, { vector: args.vector, metadata: args.metadata, updatedAt: Date.now() });
      return existing._id;
    }
    return await ctx.db.insert("jobEmbeddings", { jobId: args.jobId, vector: args.vector, section: args.section, metadata: args.metadata, updatedAt: Date.now() });
  },
});


// API Actions


export const get = query({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.jobId);
  },
});

export const getSourceData = query({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    return await ctx.db.query("jobSourceData").withIndex("by_job_id", (q) => q.eq("jobId", args.jobId)).first();
  },
});

export const getProfile = query({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    return await ctx.db.query("jobProfiles").withIndex("by_job_id", (q) => q.eq("jobId", args.jobId)).first();
  },
});


export const list = query({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    return await ctx.db.query("jobs").order("desc").collect();
  },
});

export const listPaginated = query({
  args: {
    search: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const search = args.search?.toLowerCase().trim();
    if(!search) {
      return await ctx.db.query("jobs").order("desc").paginate(args.paginationOpts);
    }

    return await ctx.db.query("jobs").withSearchIndex("by_title", (q) => q.search("title", search)).paginate(args.paginationOpts);

  },
});

export const search = query({
  args: {
    search: v.string(),
  },
  handler: async (ctx, args) => {
    if(args.search.length === 0) {
      return await ctx.db.query("jobs").order("desc").take(10);
    }
    return await ctx.db.query("jobs").withSearchIndex("by_teamtailor_title", (q) => q.search("teamtailorTitle", args.search)).take(10);
  },
});


export const add = action({
  args: {
    teamtailorId: v.string(),
  },
  returns: v.object({ taskId: v.id("tasks") }),
  handler: async (ctx, args): Promise<{ taskId: Id<"tasks"> }> => {
    const { taskId } = await enqueueTask(ctx, "import", "user", { teamtailorId: args.teamtailorId, type: "job" });
    return { taskId };
  }
});




export const addMany = action({
  args: {
    teamtailorIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    for (const teamtailorId of args.teamtailorIds) {
      await enqueueTask(ctx, "import", "user", { teamtailorId: teamtailorId, type: "job" });
    }
  }
});



export const getJobsCount = query({
  args: {
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const search = args.search?.toLowerCase().trim();
    if(!search) {
      return (await ctx.db.query("jobs").collect()).length;
    }
    return (await ctx.db.query("jobs").withSearchIndex("by_title", (q) => q.search("title", search)).collect()).length;
  },
});

export const getProcessingStatus = query({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
      const job = await ctx.db.get(args.jobId);
      if (job?.processingTask) {
        const task = await ctx.db.get(job.processingTask);
        return {
          status: task?.status || "unknown",
          progress: task?.progress || 0,
          progressMessages: task?.progressMessages || [],
          errorMessage: task?.errorMessage || "",
        };
      }
      return {
        status: "unknown",
        progress: 0,
        progressMessages: [],
        errorMessage: "",
      };
    },
});

export const rebuildProfile = action({
  args: { jobId: v.id("jobs") },
  returns: v.object({ taskId: v.id("tasks") }),
  handler: async (ctx, args): Promise<{ taskId: Id<"tasks"> }> => {
    const { jobId } = args;
    
    // Check if job exists
    const job = await ctx.runQuery(api.jobs.get, { jobId });
    if (!job) {
      throw new Error("Job not found");
    }
    
    // Enqueue rebuild profile task
    const { taskId } = await enqueueTask(ctx, "build_profile", "user", { type: "job", id: jobId });
    return { taskId };
  }
});

export const reembedProfile = action({
  args: { jobId: v.id("jobs") },
  returns: v.object({ taskId: v.id("tasks") }),
  handler: async (ctx, args): Promise<{ taskId: Id<"tasks"> }> => {
    const { jobId } = args;
    
    // Check if job exists and has a profile
    const job = await ctx.runQuery(api.jobs.get, { jobId });
    if (!job) {
      throw new Error("Job not found");
    }
    
    const profile = await ctx.runQuery(api.jobs.getProfile, { jobId });
    if (!profile) {
      throw new Error("Job profile not found. Please rebuild profile first.");
    }
    
    // Enqueue re-embed profile task
    const { taskId } = await enqueueTask(ctx, "embed_profile", "user", { type: "job", id: jobId });
    return { taskId };
  }
});

//Http Actions

export const addJob = httpAction(async (ctx, request) => {
  //validate api token
  const authHeader = request.headers.get("authorization");
  const expectedToken = process.env.HTTP_API_TOKEN;
  if (!expectedToken) {
    return new Response("API token not configured", { status: 500 });
  }
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response("Missing or invalid authorization header", { status: 401 });
  }
  const token = authHeader.substring(7); // Remove "Bearer " prefix
  if (token !== expectedToken) {
    return new Response("Invalid API token", { status: 401 });
  }

  const { orderNumber, title, company, recruiters, salesRepresentatives, locations, type, body } = await request.json();


  console.log(orderNumber, title, company, recruiters, salesRepresentatives, locations, type, body);

  //Create or get company id
  const companyId = await ctx.runMutation(internal.companies.connectOrCreate, { name: company });
  //create or get recruiter ids
  const recruiterIds = [];
  for (const recruiter of recruiters) {
    const recruiterId = await ctx.runMutation(internal.users.connectOrCreate, { email: recruiter });
    recruiterIds.push(recruiterId);
  }
  //create or get sales representative ids
  const salesRepresentativeIds = [];
  for (const salesRepresentative of salesRepresentatives) {
    const salesRepresentativeId = await ctx.runMutation(internal.users.connectOrCreate, { email: salesRepresentative });
    salesRepresentativeIds.push(salesRepresentativeId);
  }
  //create job record
  const jobId = await ctx.runMutation(internal.jobs.create, {
    orderNumber,
    title,
    type,
    companyId,
    locations,
    recruiters: recruiterIds,
    salesRepresentatives: salesRepresentativeIds,
    rawData: body,
  });
  //upsert job source data
  await ctx.runMutation(internal.jobs.upsertSourceData, {
    jobId,
    body: body,
  });
  //enqueue build profile task
  await enqueueTask(ctx, "build_profile", "system", { type: "job", id: jobId });




  return new Response("Job added", {
    status: 200,
  });
});