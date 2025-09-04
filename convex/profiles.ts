import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";

export const upsertCandidateProfile = internalMutation({
  args: {
    candidateId: v.id("candidates"),
    summary: v.optional(v.string()),
    raw: v.optional(v.string()),
    metadata: v.optional(v.any()),
    education: v.optional(
      v.array(
        v.object({
          institution: v.optional(v.string()),
          degree: v.optional(v.string()),
          field: v.optional(v.string()),
          startDate: v.optional(v.string()),
          endDate: v.optional(v.string()),
          notes: v.optional(v.string()),
        })
      )
    ),
    skills: v.optional(
      v.array(
        v.object({
          name: v.string(),
          score: v.number(),
        })
      )
    ),
    workExperience: v.optional(
      v.array(
        v.object({
          company: v.optional(v.string()),
          title: v.optional(v.string()),
          startDate: v.optional(v.string()),
          endDate: v.optional(v.string()),
          responsibilities: v.optional(v.array(v.string())),
        })
      )
    ),
    updatedAt: v.number(),
  },
  returns: v.id("candidateProfiles"),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("candidateProfiles")
      .withIndex("by_candidate_id", (q) => q.eq("candidateId", args.candidateId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        summary: args.summary ?? existing.summary,
        raw: args.raw ?? existing.raw,
        metadata: args.metadata ?? existing.metadata,
        education: args.education ?? existing.education,
        skills: args.skills ?? existing.skills,
        workExperience: args.workExperience ?? existing.workExperience,
        updatedAt: args.updatedAt,
      } as any);
      return existing._id;
    }
    return await ctx.db.insert("candidateProfiles", {
      candidateId: args.candidateId,
      summary: args.summary,
      raw: args.raw,
      metadata: args.metadata,
      education: args.education,
      skills: args.skills,
      workExperience: args.workExperience,
      updatedAt: args.updatedAt,
    } as any);
  },
});

export const getProfilesByCandidateIds = query({
  args: { candidateIds: v.array(v.id("candidates")) },
  returns: v.array(
    v.object({
      candidateId: v.id("candidates"),
      summary: v.optional(v.string()),
      raw: v.optional(v.string()),
      metadata: v.optional(v.any()),
      education: v.optional(
        v.array(
          v.object({
            institution: v.optional(v.string()),
            degree: v.optional(v.string()),
            field: v.optional(v.string()),
            startDate: v.optional(v.string()),
            endDate: v.optional(v.string()),
            notes: v.optional(v.string()),
          })
        )
      ),
      skills: v.optional(
        v.array(
          v.object({
            name: v.string(),
            score: v.number(),
          })
        )
      ),
      workExperience: v.optional(
        v.array(
          v.object({
            company: v.optional(v.string()),
            title: v.optional(v.string()),
            startDate: v.optional(v.string()),
            endDate: v.optional(v.string()),
            responsibilities: v.optional(v.array(v.string())),
          })
        )
      ),
      updatedAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const results: Array<any> = [];
    for (const id of args.candidateIds) {
      const row = await ctx.db
        .query("candidateProfiles")
        .withIndex("by_candidate_id", (q) => q.eq("candidateId", id))
        .first();
      if (row) {
        results.push({
          candidateId: row.candidateId,
          summary: row.summary,
          raw: row.raw,
          metadata: row.metadata,
          education: row.education,
          skills: row.skills,
          workExperience: row.workExperience,
          updatedAt: row.updatedAt,
        });
      }
    }
    return results;
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
  returns: v.array(
    v.object({
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
    })
  ),
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

