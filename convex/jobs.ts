import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";

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


