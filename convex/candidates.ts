import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";

// Profiles (moved from profiles.ts)
export const upsertCandidateProfile = internalMutation({
  args: {
    candidateId: v.id("candidates"),
    summary: v.optional(v.string()),
    raw: v.optional(v.string()),
    metadata: v.optional(v.any()),
    education: v.optional(
      v.array(
        v.object({
          institution: v.optional(v.union(v.string(), v.null())),
          degree: v.optional(v.union(v.string(), v.null())),
          field: v.optional(v.union(v.string(), v.null())),
          startDate: v.optional(v.union(v.string(), v.null())),
          endDate: v.optional(v.union(v.string(), v.null())),
          notes: v.optional(v.union(v.string(), v.null())),
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
          company: v.optional(v.union(v.string(), v.null())),
          title: v.optional(v.union(v.string(), v.null())),
          startDate: v.optional(v.union(v.string(), v.null())),
          endDate: v.optional(v.union(v.string(), v.null())),
          responsibilities: v.optional(v.array(v.string())),
        })
      )
    ),
    updatedAt: v.number(),
  },
  returns: v.id("candidateProfiles"),
  handler: async (ctx, args) => {
    const normalizeEducation = (ed?: Array<any>) =>
      ed?.map((e) => ({
        institution: e.institution ?? undefined,
        degree: e.degree ?? undefined,
        field: e.field ?? undefined,
        startDate: e.startDate ?? undefined,
        endDate: e.endDate ?? undefined,
        notes: e.notes ?? undefined,
      }));
    const normalizeWorkExperience = (we?: Array<any>) =>
      we?.map((w) => ({
        company: w.company ?? undefined,
        title: w.title ?? undefined,
        startDate: w.startDate ?? undefined,
        endDate: w.endDate ?? undefined,
        responsibilities: w.responsibilities ?? undefined,
      }));
    const normalizedEducation = normalizeEducation(args.education as any);
    const normalizedWorkExperience = normalizeWorkExperience(args.workExperience as any);
    const existing = await ctx.db
      .query("candidateProfiles")
      .withIndex("by_candidate_id", (q) => q.eq("candidateId", args.candidateId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        summary: args.summary ?? existing.summary,
        raw: args.raw ?? existing.raw,
        metadata: args.metadata ?? existing.metadata,
        education: normalizedEducation ?? existing.education,
        skills: args.skills ?? existing.skills,
        workExperience: normalizedWorkExperience ?? existing.workExperience,
        updatedAt: args.updatedAt,
      } as any);
      return existing._id;
    }
    return await ctx.db.insert("candidateProfiles", {
      candidateId: args.candidateId,
      summary: args.summary,
      raw: args.raw,
      metadata: args.metadata,
      education: normalizedEducation,
      skills: args.skills,
      workExperience: normalizedWorkExperience,
      updatedAt: args.updatedAt,
    } as any);
  },
});

export const getProfilesByCandidateIds = query({
  args: { candidateIds: v.array(v.id("candidates")) },
  returns: v.array(v.any()),
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

// Candidate core data
export const createCandidateRecord = internalMutation({
  args: {
    teamtailorId: v.string(),
    name: v.string(),
    imageUrl: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    updatedAt: v.number(),
    rawData: v.any(),
  },
  returns: v.union(v.id("candidates"), v.null()),
  handler: async (ctx, args) => {
    const existingCandidate = await ctx.db
      .query("candidates")
      .withIndex("by_teamtailor_id", (q) => q.eq("teamtailorId", args.teamtailorId))
      .first();
    if (existingCandidate) {
      await ctx.db.patch(existingCandidate._id, {
        name: args.name,
        imageUrl: args.imageUrl ?? existingCandidate.imageUrl,
        email: args.email,
        phone: args.phone,
        updatedAt: args.updatedAt,
        rawData: args.rawData,
      } as any);
      return existingCandidate._id;
    }
    const newId = await ctx.db.insert("candidates", {
      teamtailorId: args.teamtailorId,
      name: args.name,
      imageUrl: args.imageUrl,
      email: args.email,
      phone: args.phone,
      updatedAt: args.updatedAt,
      rawData: args.rawData,
    } as any);
    return newId;
  },
});

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

export const setCandidateProcessingStatus = internalMutation({
  args: { candidateId: v.id("candidates"), processingStatus: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    try { await ctx.db.patch(args.candidateId as any, { processingStatus: args.processingStatus } as any); } catch {}
    return null;
  },
});

export const getCandidates = query({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx) => {
    return await ctx.db.query("candidates").collect();
  },
});

export const getSourceDataByCandidateIds = query({
  args: { candidateIds: v.array(v.id("candidates")) },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const results: any[] = [];
    for (const candidateId of args.candidateIds) {
      const row = await ctx.db
        .query("candidateSourceData")
        .withIndex("by_candidate_id", (q) => q.eq("candidateId", candidateId))
        .first();
      if (row) results.push(row);
    }
    return results;
  },
});

export const getCandidateById = query({
  args: { candidateId: v.id("candidates") },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.candidateId);
  },
});




