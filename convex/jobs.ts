import { action, internalMutation, query } from "./_generated/server";
import { v } from "convex/values";
import { enqueueTask } from "./tasks";
import { api } from "./_generated/api";


export const createJob = internalMutation({
  args: {
    teamtailorId: v.string(), 
    title: v.optional(v.string()),
    company: v.optional(v.string()),
    location: v.optional(v.string()),
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
      title: args.title,
      company: args.company,
      location: args.location,
      rawData: args.rawData,
      processingTask: args.processingTask,
      updatedAt: Date.now(),
      updatedAtTT: args.updatedAtTT,
      createdAtTT: args.createdAtTT,
    } );
    return jobId;
  },
});
export const upsertJobProfile = internalMutation({
  args: {
    jobId: v.id("jobs"),
    summary: v.optional(v.string()),
    responsibilities: v.optional(v.array(v.string())),
    requirements: v.optional(v.array(v.string())),
    skills: v.optional(
      v.array(
        v.object({
          name: v.string(),
          score: v.number(),
        })
      )
    ),
    raw: v.optional(v.string()),
    metadata: v.optional(v.any()),
    updatedAt: v.number(),
  },
  returns: v.id("jobProfiles"),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("jobProfiles")
      .withIndex("by_job_id", (q) => q.eq("jobId", args.jobId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        summary: args.summary ?? existing.summary,
        responsibilities: args.responsibilities ?? existing.responsibilities,
        requirements: args.requirements ?? existing.requirements,
        skills: args.skills ?? existing.skills,
        raw: args.raw ?? existing.raw,
        metadata: args.metadata ?? existing.metadata,
        updatedAt: args.updatedAt,
      } as any);
      return existing._id;
    }
    return await ctx.db.insert("jobProfiles", {
      jobId: args.jobId,
      summary: args.summary,
      responsibilities: args.responsibilities,
      requirements: args.requirements,
      skills: args.skills,
      raw: args.raw,
      metadata: args.metadata,
      updatedAt: args.updatedAt,
    } as any);
  },
});

export const getJobProfilesByJobIds = query({
  args: { jobIds: v.array(v.id("jobs")) },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const results: Array<any> = [];
    for (const id of args.jobIds) {
      const row = await ctx.db
        .query("jobProfiles")
        .withIndex("by_job_id", (q) => q.eq("jobId", id))
        .first();
      if (row) {
        results.push({
          jobId: row.jobId,
          summary: row.summary,
          responsibilities: row.responsibilities,
          requirements: row.requirements,
          skills: row.skills,
          raw: row.raw,
          metadata: row.metadata,
          updatedAt: row.updatedAt,
        });
      }
    }
    return results;
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

export const getJobs = query({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx) => {
    return await ctx.db.query("jobs").collect();
  },
});

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

export const setJobProcessingStatus = internalMutation({
  args: { jobId: v.id("jobs"), processingStatus: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    try { await ctx.db.patch(args.jobId as any, { processingStatus: args.processingStatus } as any); } catch {}
    return null;
  },
});

// API Actions
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

// New queries for jobs page with search and pagination
export const listJobsPaginated = query({
  args: {
    search: v.optional(v.string()),
    page: v.optional(v.number()),
    perPage: v.optional(v.number()),
    sortBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const page = args.page ?? 1;
    const perPage = args.perPage ?? 25;
    const search = args.search?.toLowerCase().trim();
    const sortBy = args.sortBy ?? "-updatedAt";

    let jobs = await ctx.db.query("jobs").collect();

    // Apply search filter
    if (search) {
      jobs = jobs.filter((job) => {
        const title = job?.rawData?.attributes?.title?.toLowerCase() ?? "";
        const company = job?.rawData?.attributes?.company?.toLowerCase() ?? "";
        const location = job?.rawData?.attributes?.location?.toLowerCase() ?? "";
        const department = job?.rawData?.attributes?.department?.toLowerCase() ?? "";
        return title.includes(search) || company.includes(search) || location.includes(search) || department.includes(search);
      });
    }

    // Apply sorting
    jobs.sort((a, b) => {
      if (sortBy === "-updatedAt") {
        return (b.updatedAt ?? b._creationTime) - (a.updatedAt ?? a._creationTime);
      } else if (sortBy === "updatedAt") {
        return (a.updatedAt ?? a._creationTime) - (b.updatedAt ?? b._creationTime);
      } else if (sortBy === "-createdAt") {
        return b._creationTime - a._creationTime;
      } else if (sortBy === "createdAt") {
        return a._creationTime - b._creationTime;
      } else if (sortBy === "title") {
        const titleA = a?.rawData?.attributes?.title ?? "";
        const titleB = b?.rawData?.attributes?.title ?? "";
        return titleA.localeCompare(titleB);
      } else if (sortBy === "-title") {
        const titleA = a?.rawData?.attributes?.title ?? "";
        const titleB = b?.rawData?.attributes?.title ?? "";
        return titleB.localeCompare(titleA);
      }
      return 0;
    });

    // Apply pagination
    const totalCount = jobs.length;
    const totalPages = Math.ceil(totalCount / perPage);
    const startIndex = (page - 1) * perPage;
    const endIndex = startIndex + perPage;
    const paginatedJobs = jobs.slice(startIndex, endIndex);

    return {
      jobs: paginatedJobs,
      pagination: {
        currentPage: page,
        perPage,
        totalPages,
        totalCount,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  },
});

export const getJobsCount = query({
  args: {
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const search = args.search?.toLowerCase().trim();
    
    let jobs = await ctx.db.query("jobs").collect();

    if (search) {
      jobs = jobs.filter((job) => {
        const title = job?.rawData?.attributes?.title?.toLowerCase() ?? "";
        const company = job?.rawData?.attributes?.company?.toLowerCase() ?? "";
        const location = job?.rawData?.attributes?.location?.toLowerCase() ?? "";
        const department = job?.rawData?.attributes?.department?.toLowerCase() ?? "";
        return title.includes(search) || company.includes(search) || location.includes(search) || department.includes(search);
      });
    }

    return jobs.length;
  },
});

export const getJobById = query({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.jobId);
  },
});

export const getProcessingStatusByJobIds = query({
  args: { jobIds: v.array(v.id("jobs")) },
  handler: async (ctx, args) => {
    const processingStatuses = [];
    for (const jobId of args.jobIds) {
      const job = await ctx.db.get(jobId);
      if (job?.processingTask) {
        const task = await ctx.db.get(job.processingTask);
        processingStatuses.push({
          jobId,
          status: task?.status || "unknown",
          progress: task?.progress || 0,
          progressMessage: task?.progressMessage || "",
          errorMessage: task?.errorMessage || "",
        });
      } else {
        processingStatuses.push({
          jobId,
          status: "none",
          progress: 0,
          progressMessage: "",
          errorMessage: "",
        });
      }
    }
    return processingStatuses;
  },
});


