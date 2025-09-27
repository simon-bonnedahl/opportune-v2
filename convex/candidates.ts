import { action, internalMutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { enqueueTask } from "./tasks";
import { candidateProfileSections } from "./tables/candidates";
import { api, internal } from "./_generated/api";
import { paginationOptsValidator } from "convex/server";

// Helpers
// Helper function to validate candidate profile completeness
export function validateCandidateProfile(profile: any): void {
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

  if (!profile.workExperience || profile.workExperience.length === 0) {
    emptyFields.push("workExperience");
  }

  if (!profile.preferences || profile.preferences.length === 0) {
    emptyFields.push("preferences");
  }

  if (!profile.aspirations || profile.aspirations.length === 0) {
    emptyFields.push("aspirations");
  }

  if (emptyFields.length > 0) {
    throw new Error(`Couldnt embed candidate profile. Missing or empty fields: ${emptyFields.join(", ")}`);
  }
}


// Internal



export const create = internalMutation({
  args: {
    teamtailorId: v.string(),
    name: v.string(),
    imageUrl: v.optional(v.string()),
    email: v.optional(v.string()),
    linkedinUrl: v.optional(v.string()),
    phone: v.optional(v.string()),
    rawData: v.any(),
    processingTask: v.optional(v.id("tasks")),
    updatedAtTT: v.number(),
    createdAtTT: v.number(),
  },
  handler: async (ctx, args) => {
    const existingCandidate = await ctx.db
      .query("candidates")
      .withIndex("by_teamtailor_id", (q) => q.eq("teamtailorId", args.teamtailorId))
      .first();

    if (existingCandidate) {
      await ctx.db.patch(existingCandidate._id, {
        name: args.name,
        imageUrl: args.imageUrl,
        email: args.email,
        linkedinUrl: args.linkedinUrl,
        phone: args.phone,
        rawData: args.rawData,
        processingTask: args.processingTask,
        updatedAt: Date.now(),
        updatedAtTT: args.updatedAtTT,
        createdAtTT: args.createdAtTT,
      });
      return existingCandidate._id;
    }

    return await ctx.db.insert("candidates", {
      teamtailorId: args.teamtailorId,
      name: args.name,
      imageUrl: args.imageUrl,
      email: args.email,
      linkedinUrl: args.linkedinUrl,
      phone: args.phone,
      rawData: args.rawData,
      processingTask: args.processingTask,
      updatedAt: Date.now(),
      updatedAtTT: args.updatedAtTT,
      createdAtTT: args.createdAtTT,
    });
  },
});

export const upsertEmbedding = internalMutation({
  args: { candidateId: v.id("candidates"), vector: v.array(v.number()), section: candidateProfileSections, metadata: v.optional(v.any()) },
  handler: async (ctx, args) => {
    //update if exists - query by both candidateId and section to avoid race conditions
    const existing = await ctx.db.query("candidateEmbeddings").withIndex("by_candidate_id_and_section", (q) =>
      q.eq("candidateId", args.candidateId).eq("section", args.section)
    ).first();

    if (existing) {
      await ctx.db.patch(existing._id, { vector: args.vector, metadata: args.metadata, updatedAt: Date.now() });
      return existing._id;
    }
    return await ctx.db.insert("candidateEmbeddings", { candidateId: args.candidateId, vector: args.vector, section: args.section, metadata: args.metadata, updatedAt: Date.now() });
  },
});


export const upsertSourceData = internalMutation({
  args: {
    candidateId: v.id("candidates"),
    assessment: v.optional(v.any()),
    hubertAnswers: v.optional(v.any()),
    hubertUrl: v.optional(v.string()),
    resumeSummary: v.optional(v.string()),
    linkedinSummary: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("candidateSourceData")
      .withIndex("by_candidate_id", (q) => q.eq("candidateId", args.candidateId))
      .first();
    if (existing) {
      const update = {
        assessment: args.assessment ?? existing.assessment,
        hubertAnswers: args.hubertAnswers ?? existing.hubertAnswers,
        hubertUrl: args.hubertUrl ?? existing.hubertUrl,
        resumeSummary: args.resumeSummary ?? existing.resumeSummary,
        linkedinSummary: args.linkedinSummary ?? existing.linkedinSummary,
        updatedAt: Date.now(),
      };
      await ctx.db.patch(existing._id, update);
      return existing._id;
    }
    const doc = {
      candidateId: args.candidateId,
      assessment: args.assessment ?? undefined,
      hubertAnswers: args.hubertAnswers,
      hubertUrl: args.hubertUrl,
      resumeSummary: args.resumeSummary,
      linkedinSummary: args.linkedinSummary,
      updatedAt: Date.now(),
    };
    return await ctx.db.insert("candidateSourceData", doc);
  },
});


export const upsertProfile = internalMutation({
  args: {
    candidateId: v.id("candidates"),
    summary: v.string(),
    description: v.string(),
    raw: v.string(),
    metadata: v.any(),
    education: v.array(v.string()),
    workExperience: v.array(v.string()),
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
      .query("candidateProfiles")
      .withIndex("by_candidate_id", (q) => q.eq("candidateId", args.candidateId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { ...args, updatedAt: Date.now() });
      return existing._id;
    }

    return await ctx.db.insert("candidateProfiles", { ...args, updatedAt: Date.now() });
  },
});

export const setProcessingTask = internalMutation({
  args: { candidateId: v.id("candidates"), processingTask: v.id("tasks") },
  handler: async (ctx, args) => {
    return await ctx.db.patch(args.candidateId, { processingTask: args.processingTask });
  },
});


//Api

export const get = query({
  args: { candidateId: v.id("candidates") },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.candidateId);
  },
});



export const getSourceData = query({
  args: { candidateId: v.id("candidates") },
  handler: async (ctx, args) => {
    return await ctx.db.query("candidateSourceData").withIndex("by_candidate_id", (q) => q.eq("candidateId", args.candidateId)).unique();
  },
});


export const getProfile = query({
  args: { candidateId: v.id("candidates") },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    return await ctx.db.query("candidateProfiles").withIndex("by_candidate_id", (q) => q.eq("candidateId", args.candidateId)).unique();
  },
});


export const list = query({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx) => {
    return await ctx.db.query("candidates").order("desc").collect();
  },
});

// New queries for candidates page with search and pagination
export const listPaginated = query({
  args: {
    paginationOpts: paginationOptsValidator,
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const search = args.search?.toLowerCase().trim();
    if (!search) {
      return await ctx.db.query("candidates").order("desc").paginate(args.paginationOpts);
    }

    return await ctx.db.query("candidates").withSearchIndex("by_name", (q) => q.search("name", search)).paginate(args.paginationOpts);


  },
});


export const search = query({
  args: {
    search: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.search.length === 0) {
      return await ctx.db.query("candidates").order("desc").take(10);
    }
    return await ctx.db.query("candidates").withSearchIndex("by_name", (q) => q.search("name", args.search)).take(10);
  },
});



export const add = action({
  args: {
    teamtailorId: v.string(),
  },
  returns: v.object({ taskId: v.id("tasks") }),
  handler: async (ctx, args): Promise<{ taskId: Id<"tasks"> }> => {
    const { taskId } = await enqueueTask(ctx, "import", "user", { teamtailorId: args.teamtailorId, type: "candidate" });
    return { taskId };
  }
});

export const addMany = action({
  args: {
    teamtailorIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    for (const teamtailorId of args.teamtailorIds) {
      await enqueueTask(ctx, "import", "user", { teamtailorId: teamtailorId, type: "candidate" });
    }
  }
});

export const addByUpdatedTT = action({
  args: {
    updatedAtTT: v.number(),
  },
  handler: async (ctx, args) => {
    const candidates = await ctx.runAction(internal.teamtailor.getCandidatesByUpdatedTT, { updatedAtTT: args.updatedAtTT });
    const teamtailorIds = candidates.map((candidate) => candidate.id);

    //addMany with teamtailorIds
    await ctx.runAction(api.candidates.addMany, { teamtailorIds: teamtailorIds });
  }
});



export const getCandidatesCount = query({
  args: {
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const search = args.search?.toLowerCase().trim();

    let candidates = await ctx.db.query("candidates").collect();

    if (search) {
      candidates = candidates.filter((candidate) => {
        const name = candidate.name?.toLowerCase() ?? "";
        const email = candidate.email?.toLowerCase() ?? "";
        const phone = candidate.phone?.toLowerCase() ?? "";
        return name.includes(search) || email.includes(search) || phone.includes(search);
      });
    }

    return candidates.length;
  },
});


export const getProcessingStatus = query({
  args: { candidateId: v.id("candidates") },
  handler: async (ctx, args) => {
    const candidate = await ctx.db.get(args.candidateId);
    if (candidate?.processingTask) {
      const task = await ctx.db.get(candidate.processingTask);
      return {
        status: task?.status || "succeeded",
        progress: task?.progress || 0,
        progressMessages: task?.progressMessages || [],
        errorMessage: task?.errorMessage || "",
      };
    }
    return {
      status: "succeeded",
      progress: 0,
      progressMessages: [],
      errorMessage: "",
    };
  },
});

export const rebuildProfile = action({
  args: { candidateId: v.id("candidates") },
  returns: v.object({ taskId: v.id("tasks") }),
  handler: async (ctx, args): Promise<{ taskId: Id<"tasks"> }> => {
    const { candidateId } = args;

    // Check if candidate exists
    const candidate = await ctx.runQuery(api.candidates.get, { candidateId });
    if (!candidate) {
      throw new Error("Candidate not found");
    }

    // Enqueue rebuild profile task
    const { taskId } = await enqueueTask(ctx, "build_profile", "user", { type: "candidate", id: candidateId });
    return { taskId };
  }
});

export const reembedProfile = action({
  args: { candidateId: v.id("candidates") },
  returns: v.object({ taskId: v.id("tasks") }),
  handler: async (ctx, args): Promise<{ taskId: Id<"tasks"> }> => {
    const { candidateId } = args;

    // Check if candidate exists and has a profile
    const candidate = await ctx.runQuery(api.candidates.get, { candidateId });
    if (!candidate) {
      throw new Error("Candidate not found");
    }

    const profile = await ctx.runQuery(api.candidates.getProfile, { candidateId });
    if (!profile) {
      throw new Error("Candidate profile not found. Please rebuild profile first.");
    }

    // Enqueue re-embed profile task
    const { taskId } = await enqueueTask(ctx, "embed_profile", "user", { type: "candidate", id: candidateId });
    return { taskId };
  }
});


