import { internalMutation, mutation } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";


type OpenAIFile = { id: string };

export const enqueueBuildProfile = mutation({
  args: { candidateId: v.id("candidates") },
  returns: v.null(),
  handler: async (ctx, { candidateId }) => {
    await ctx.runMutation(api.tasks.enqueueTask, {
      taskType: "build_profile",
      candidateId,
      priority: 0,
      requestedBy: "system",
      argsSummary: { candidateId },
    } as any);
    return null;
  },
});

export const enqueueBuildCandidateEmbeddings = internalMutation({
  args: { candidateId: v.id("candidates") },
  returns: v.null(),
  handler: async (ctx, { candidateId }) => {
    await ctx.runMutation(api.tasks.enqueueTask, {
      taskType: "embed",
      candidateId,
      requestedBy: "system",
      argsSummary: { candidateId },
    } as any);
    try { await ctx.runMutation(internal.teamtailor.setCandidateProcessingStatus, { candidateId, processingStatus: "embeddings_building" }); } catch {}
    return null;
  },
});

export const enqueueBuildJobEmbeddings = internalMutation({
  args: { jobId: v.id("jobs") },
  returns: v.null(),
  handler: async (ctx, { jobId }) => {
    await ctx.runMutation(api.tasks.enqueueTask, {
      taskType: "embed",
      jobId,
      requestedBy: "system",
      argsSummary: { jobId },
    } as any);
    return null;
  },
});

export const queueBuildJobEmbeddings = mutation({
  args: { jobId: v.id("jobs") },
  returns: v.null(),
  handler: async (ctx, { jobId }) => {
    await ctx.runMutation(internal.openai.enqueueBuildJobEmbeddings, { jobId });
    return null;
  },
});

export const queueBuildCandidateEmbeddings = mutation({
  args: { candidateId: v.id("candidates") },
  returns: v.null(),
  handler: async (ctx, { candidateId }) => {
    await ctx.runMutation(internal.openai.enqueueBuildCandidateEmbeddings, { candidateId });
    return null;
  },
});

export const enqueueMatchCandidateToJob = internalMutation({
  args: { candidateId: v.id("candidates"), jobId: v.id("jobs") },
  returns: v.null(),
  handler: async (ctx, { candidateId, jobId }) => {
    await ctx.runMutation(api.tasks.enqueueTask, {
      taskType: "match",
      candidateId,
      jobId,
      requestedBy: "system",
      argsSummary: { candidateId, jobId },
    } as any);
    return null;
  },
});

export const queueMatchCandidateToJob = mutation({
  args: { candidateId: v.id("candidates"), jobId: v.id("jobs") },
  returns: v.null(),
  handler: async (ctx, { candidateId, jobId }) => {
    await ctx.runMutation(internal.openai.enqueueMatchCandidateToJob, { candidateId, jobId });
    return null;
  },
});

// upsertCandidateProfile moved to profiles.ts (mutation runtime)


