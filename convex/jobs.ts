import { action, internalMutation, query } from "./_generated/server";
import { v } from "convex/values";
import { enqueueTask } from "./tasks";
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
    teamtailorId: v.string(), 
    teamtailorTitle: v.string(),
    title: v.optional(v.string()),
    companyId: v.optional(v.id("companies")),
    orderNumber: v.optional(v.string()),
    rawData: v.any(),
    processingTask: v.optional(v.id("tasks")),
    updatedAtTT: v.number(),
    createdAtTT: v.number(),
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
      locations: [],  
      orderNumber: args.orderNumber,
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
    softSkills: (v.array(

      v.object({
        name: v.string(),
        score: v.number(),
      })

    )),
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
  },
  returns: v.union(v.id("jobSourceData"), v.null()),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("jobSourceData")
      .withIndex("by_job_id", (q) => q.eq("jobId", args.jobId))
      .first();
    const doc = {
      teamtailorBody: args.teamtailorBody,
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
      await ctx.db.patch(existing._id, { vector: args.vector, metadata: args.metadata });
      return existing._id;
    }
    return await ctx.db.insert("jobEmbeddings", { jobId: args.jobId, vector: args.vector, section: args.section, metadata: args.metadata });
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
  handler: async (ctx, args) => {
    await enqueueTask(ctx, "import", "user", { teamtailorId: args.teamtailorId, type: "job" });
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
          progressMessage: task?.progressMessage || "",
          errorMessage: task?.errorMessage || "",
        };
      }
      return {
        status: "unknown",
        progress: 0,
        progressMessage: "",
        errorMessage: "",
      };
    },
});

