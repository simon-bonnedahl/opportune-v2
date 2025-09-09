import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";

export const saveMatch = internalMutation({
  args: {
    candidateId: v.id("candidates"),
    jobId: v.id("jobs"),
    model: v.optional(v.string()),
    score: v.number(),
    explanation: v.optional(v.string()),
    metadata: v.optional(v.any()),
    updatedAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const normalizedModel: string = String(
      args.model ?? (args.metadata as any)?.model ?? "unknown"
    );
    const existing = await ctx.db
      .query("matches")
      .withIndex("by_candidate_job_model", (q) => q.eq("candidateId", args.candidateId).eq("jobId", args.jobId).eq("model", normalizedModel))
      .unique();
    const payload = {
      model: normalizedModel,
      score: Math.max(0, Math.min(1, args.score)),
      explanation: args.explanation,
      metadata: args.metadata,
      updatedAt: args.updatedAt,
    };
    if (existing) {
      await ctx.db.patch(existing._id, payload);
    } else {
      await ctx.db.insert("matches", { candidateId: args.candidateId, jobId: args.jobId, ...payload } as any);
    }
    return null;
  },
});

export const listMatchesByCandidate = internalMutation({
  args: { candidateId: v.id("candidates"), limit: v.optional(v.number()) },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    const rows: any[] = [];
    for await (const it of ctx.db
      .query("matches")
      .withIndex("by_candidate", (q) => q.eq("candidateId", args.candidateId))) {
      rows.push(it);
      if (rows.length >= limit) break;
    }
    rows.sort((a, b) => (b.updatedAt ?? b._creationTime) - (a.updatedAt ?? a._creationTime));
    return rows;
  },
});

export const listMatchesByJob = internalMutation({
  args: { jobId: v.id("jobs"), limit: v.optional(v.number()) },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    const rows: any[] = [];
    for await (const it of ctx.db
      .query("matches")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))) {
      rows.push(it);
      if (rows.length >= limit) break;
    }
    rows.sort((a, b) => (b.updatedAt ?? b._creationTime) - (a.updatedAt ?? a._creationTime));
    return rows;
  },
});

export const listMatchesForCandidate = query({
  args: { candidateId: v.union(v.id("candidates"), v.string()), limit: v.optional(v.number()) },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    const rows: any[] = [];
    const cid = args.candidateId as any;
    for await (const it of ctx.db
      .query("matches")
      .withIndex("by_candidate", (q) => q.eq("candidateId", cid))) {
      rows.push(it);
      if (rows.length >= limit) break;
    }
    rows.sort((a, b) => (b.updatedAt ?? b._creationTime) - (a.updatedAt ?? a._creationTime));
    return rows;
  },
});

export const listMatchesForJob = query({
  args: { jobId: v.union(v.id("jobs"), v.string()), limit: v.optional(v.number()) },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    const rows: any[] = [];
    const jid = args.jobId as any;
    for await (const it of ctx.db
      .query("matches")
      .withIndex("by_job", (q) => q.eq("jobId", jid))) {
      rows.push(it);
      if (rows.length >= limit) break;
    }
    rows.sort((a, b) => (b.updatedAt ?? b._creationTime) - (a.updatedAt ?? a._creationTime));
    return rows;
  },
});

// Public query to fetch the single stored match for a candidate/job pair
export const getMatchByCandidateAndJob = query({
  args: {
    candidateId: v.union(v.id("candidates"), v.string()),
    jobId: v.union(v.id("jobs"), v.string()),
    model: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const candidateId = args.candidateId as any;
    const jobId = args.jobId as any;
    if (args.model) {
      const exact = await ctx.db
        .query("matches")
        .withIndex("by_candidate_job_model", (q) => q.eq("candidateId", candidateId).eq("jobId", jobId).eq("model", args.model as string))
        .unique();
      return exact ?? null;
    }
    let latest: any | null = null;
    for await (const it of ctx.db
      .query("matches")
      .withIndex("by_candidate", (q) => q.eq("candidateId", candidateId))) {
      if (String(it.jobId) !== String(jobId)) continue;
      if (!latest || (it.updatedAt ?? it._creationTime) > (latest.updatedAt ?? latest._creationTime)) latest = it;
    }
    return latest ?? null;
  },
});

// One-off backfill to populate missing `model` from metadata
export const backfillMissingModel = internalMutation({
  args: { limit: v.optional(v.number()) },
  returns: v.number(),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 200;
    let updated = 0;
    for await (const it of ctx.db.query("matches")) {
      if (updated >= limit) break;
      const m: any = it as any;
      if (!m.model) {
        const inferred = (m?.metadata?.model && typeof m.metadata.model === "string") ? m.metadata.model : "unknown";
        try {
          await ctx.db.patch(m._id, { model: inferred } as any);
          updated++;
        } catch {}
      }
    }
    return updated;
  },
});


