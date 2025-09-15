import { mutation, query } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { v } from "convex/values";

/**
 * Compares two vectors by doing a dot product.
 *
 * Assuming both vectors are normalized to length 1, it will be in [-1, 1].
 * @returns [-1, 1] based on similarity. (1 is the same, -1 is the opposite)
 */
export function compare(vectorA: number[], vectorB: number[]) {
  return vectorA.reduce((sum, val, idx) => sum + val * vectorB[idx], 0);
}


function cleanText(input: string | undefined | null, maxLen: number): string {
  const s = (input ?? "").replace(/\s+/g, " ").trim();
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function joinLines(lines: Array<string | undefined | null>, maxLen: number): string {
  const text = lines.filter(Boolean).map((s) => (s as string).trim()).join("\n");
  return cleanText(text, maxLen);
}

export const saveCandidateEmbeddings = mutation({
  args: {
    candidateId: v.id("candidates"),
    rows: v.array(
      v.object({
        kind: v.string(),
        text: v.string(),
        embedding: v.array(v.number()),
        embeddingModel: v.string(),
        embeddingDims: v.number(),
        embeddingVersion: v.number(),
      })
    ),
    updatedAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, { candidateId, rows, updatedAt }) => {
    const existing = ctx.db
      .query("candidateEmbeddings")
      .withIndex("by_candidate_id", (q) => q.eq("candidateId", candidateId));
    for await (const row of existing) await ctx.db.delete(row._id);
    for (const r of rows) {
      await ctx.db.insert("candidateEmbeddings", {
        candidateId,
        kind: r.kind,
        text: r.text,
        languageCode: undefined,
        embeddingModel: r.embeddingModel,
        embeddingDims: r.embeddingDims,
        embeddingVersion: r.embeddingVersion,
        embedding: r.embedding,
        updatedAt,
      } as any);
    }
    return null;
  },
});

export const saveJobEmbeddings = mutation({
  args: {
    jobId: v.id("jobs"),
    rows: v.array(
      v.object({
        kind: v.string(),
        text: v.string(),
        embedding: v.array(v.number()),
        embeddingModel: v.string(),
        embeddingDims: v.number(),
        embeddingVersion: v.number(),
      })
    ),
    updatedAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, { jobId, rows, updatedAt }) => {
    const existing = ctx.db
      .query("jobEmbeddings")
      .withIndex("by_job_id", (q) => q.eq("jobId", jobId));
    for await (const row of existing) await ctx.db.delete(row._id);
    for (const r of rows) {
      await ctx.db.insert("jobEmbeddings", {
        jobId,
        kind: r.kind,
        text: r.text,
        languageCode: undefined,
        embeddingModel: r.embeddingModel,
        embeddingDims: r.embeddingDims,
        embeddingVersion: r.embeddingVersion,
        embedding: r.embedding,
        updatedAt,
      } as any);
    }
    return null;
  },
});

export const scoreCandidateAgainstJob = query({
  args: {
    candidateId: v.optional(v.id("candidates")),
    jobId: v.optional(v.id("jobs")),
  },

  handler: async (ctx, { candidateId, jobId }) => {
    if (!candidateId || !jobId) {
      return { vectorSim: 0, skillOverlap: 0, rawScore: 0, finalScore: 0, details: { bestCandidateChunk: "", bestJobChunk: "" } } as const;
    }
    // Load embeddings
    const candEmbeds: Array<any> = await ctx.db
      .query("candidateEmbeddings")
      .withIndex("by_candidate_id", (q) => q.eq("candidateId", candidateId))
      .collect();
    const jobEmbeds: Array<any> = await ctx.db
      .query("jobEmbeddings")
      .withIndex("by_job_id", (q) => q.eq("jobId", jobId))
      .collect();

    if (candEmbeds.length === 0 || jobEmbeds.length === 0) {
      return { vectorSim: 0, rawVectorSim: 0, skillOverlap: 0, rawScore: 0, finalScore: 0, finalScoreClampedByRaw: 0, details: { bestCandidateChunk: "", bestJobChunk: "" } } as const;
    }

    const cosineSimilarity = (a: number[], b: number[]): number => {
      const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
      const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
      const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
      return magnitudeA && magnitudeB ? dotProduct / (magnitudeA * magnitudeB) : 0;
    };

    // Get individual section scores
    const getSection = (embeds: any[], kind: string) => embeds.find((e) => e.kind === kind);

    const candSkills = getSection(candEmbeds, "skills");
    const jobSkills = getSection(jobEmbeds, "skills");
    const candExperience = getSection(candEmbeds, "experience");
    const jobResponsibilities = getSection(jobEmbeds, "responsibilities");
    const jobRequirements = getSection(jobEmbeds, "requirements");
    const candSummary = getSection(candEmbeds, "summary");
    const jobSummary = getSection(jobEmbeds, "summary");
    const candEducation = getSection(candEmbeds, "education");

    // Calculate section similarities
    const skillsScore = candSkills && jobSkills
      ? cosineSimilarity(candSkills.embedding as number[], jobSkills.embedding as number[])
      : 0;
    const experienceScore = candExperience && jobResponsibilities
      ? cosineSimilarity(candExperience.embedding as number[], jobResponsibilities.embedding as number[])
      : 0;
    const summaryScore = candSummary && jobSummary
      ? cosineSimilarity(candSummary.embedding as number[], jobSummary.embedding as number[])
      : 0;
    const educationScore = candEducation && jobRequirements
      ? cosineSimilarity(candEducation.embedding as number[], jobRequirements.embedding as number[])
      : 0;

    // Raw embeddings comparison (full profile vs full profile)
    const candRaw = candEmbeds.find((e) => e.kind === "raw");
    const jobRaw = jobEmbeds.find((e) => e.kind === "raw");

    let rawScore = 0;
    if (candRaw && jobRaw) {
      rawScore = cosineSimilarity(
        candRaw.embedding as number[],
        jobRaw.embedding as number[]
      );
    }

    // Critical thresholds - below these scores, heavily penalize
    const SKILLS_THRESHOLD = 0.4;
    const EXPERIENCE_THRESHOLD = 0.3;
    const MIN_PENALTY = 0.2; // prevent total collapse when one section is weak

    // Apply multiplicative penalties for poor critical matches
    let skillsPenalty = 1.0;
    let experiencePenalty = 1.0;

    if (skillsScore < SKILLS_THRESHOLD) {
      skillsPenalty = Math.max(MIN_PENALTY, Math.pow(skillsScore / SKILLS_THRESHOLD, 2));
    }

    if (experienceScore < EXPERIENCE_THRESHOLD) {
      experiencePenalty = Math.max(MIN_PENALTY, Math.pow(experienceScore / EXPERIENCE_THRESHOLD, 1.5));
    }

    // Base weighted score with cross-section matches
    // weights: skills 0.4, experience_vs_responsibilities 0.35, summary 0.1, education_vs_requirements 0.15
    const baseScore = skillsScore * 0.4 + experienceScore * 0.35 + summaryScore * 0.1 + educationScore * 0.15;

    // Apply multiplicative penalties
    const penalizedScore = baseScore * skillsPenalty * experiencePenalty;

    // Section-based similarity (no clamp by raw)
    const vectorSim = penalizedScore;
    const rawVectorSim = rawScore;
    // Optional strict clamp variant for reference
    const clampedSim = (candRaw && jobRaw) ? Math.min(penalizedScore, rawScore * 1.2) : penalizedScore;

    // Final scores
    const finalScore = Math.min(vectorSim * 0.8 + skillsScore * 0.2, 1.0);
    const finalScoreClampedByRaw = Math.min(clampedSim * 0.8 + skillsScore * 0.2, 1.0);

    // Find best matching sections for details
    let bestSimilarity = -1;
    let bestCandChunk = "";
    let bestJobChunk = "";

    const sections: Array<[any, any, number]> = [
      [candSkills, jobSkills, skillsScore],
      [candExperience, jobResponsibilities, experienceScore],
      [candSummary, jobSummary, summaryScore],
      [candEducation, jobRequirements, educationScore],
    ];

    for (const [cand, job, score] of sections) {
      if (cand && job && score > bestSimilarity) {
        bestSimilarity = score;
        bestCandChunk = (cand.text as string) ?? "";
        bestJobChunk = (job.text as string) ?? "";
      }
    }

    // Build debug structure
    const trim = (s: string, n: number) => (s.length > n ? s.slice(0, n) + "…" : s);
    const debugSections = [
      {
        kind: "skills",
        candPresent: !!candSkills,
        jobPresent: !!jobSkills,
        similarity: Math.round((skillsScore || 0) * 1000) / 1000,
        candText: candSkills ? trim(String(candSkills.text ?? ""), 500) : "",
        jobText: jobSkills ? trim(String(jobSkills.text ?? ""), 500) : "",
      },
      {
        kind: "experience_vs_responsibilities",
        candPresent: !!candExperience,
        jobPresent: !!jobResponsibilities,
        similarity: Math.round((experienceScore || 0) * 1000) / 1000,
        candText: candExperience ? trim(String(candExperience.text ?? ""), 500) : "",
        jobText: jobResponsibilities ? trim(String(jobResponsibilities.text ?? ""), 500) : "",
      },
      {
        kind: "summary",
        candPresent: !!candSummary,
        jobPresent: !!jobSummary,
        similarity: Math.round((summaryScore || 0) * 1000) / 1000,
        candText: candSummary ? trim(String(candSummary.text ?? ""), 500) : "",
        jobText: jobSummary ? trim(String(jobSummary.text ?? ""), 500) : "",
      },
      {
        kind: "education_vs_requirements",
        candPresent: !!candEducation,
        jobPresent: !!jobRequirements,
        similarity: Math.round((educationScore || 0) * 1000) / 1000,
        candText: candEducation ? trim(String(candEducation.text ?? ""), 500) : "",
        jobText: jobRequirements ? trim(String(jobRequirements.text ?? ""), 500) : "",
      },
    ];

    const debug = {
      weights: { skills: 0.4, experience_vs_responsibilities: 0.35, summary: 0.1, education_vs_requirements: 0.15 },
      thresholds: { skills: SKILLS_THRESHOLD, experience: EXPERIENCE_THRESHOLD },
      penalties: {
        minPenalty: MIN_PENALTY,
        skillsPenalty: Math.round(skillsPenalty * 1000) / 1000,
        experiencePenalty: Math.round(experiencePenalty * 1000) / 1000,
      },
      present: { candRaw: !!candRaw, jobRaw: !!jobRaw },
      baseScore: Math.round(baseScore * 1000) / 1000,
      penalizedScore: Math.round(penalizedScore * 1000) / 1000,
      clampedSim: Math.round(clampedSim * 1000) / 1000,
      sections: debugSections,
      rawComparison: {
        similarity: Math.round(rawScore * 1000) / 1000,
        candLen: candRaw ? String(candRaw.text ?? "").length : 0,
        jobLen: jobRaw ? String(jobRaw.text ?? "").length : 0,
        candPreview: candRaw ? trim(String(candRaw.text ?? ""), 500) : "",
        jobPreview: jobRaw ? trim(String(jobRaw.text ?? ""), 500) : "",
      },
    };

    return {
      vectorSim: Math.round(vectorSim * 1000) / 1000,
      rawVectorSim: Math.round(rawVectorSim * 1000) / 1000,
      skillOverlap: Math.round(skillsScore * 1000) / 1000,
      experienceAlignment: Math.round(experienceScore * 1000) / 1000,
      educationAlignment: Math.round(educationScore * 1000) / 1000,
      rawScore: Math.round(rawScore * 1000) / 1000,
      finalScore: Math.round(finalScore * 1000) / 1000,
      finalScoreClampedByRaw: Math.round(finalScoreClampedByRaw * 1000) / 1000,
      details: {
        bestCandidateChunk: bestCandChunk,
        bestJobChunk: bestJobChunk,
      },
      debug,
    } as const;
  },
});

export const hasCandidateEmbeddings = query({
  args: { candidateId: v.optional(v.id("candidates")) },
  returns: v.boolean(),
  handler: async (ctx, { candidateId }) => {
    if (!candidateId) return false;
    const any = await ctx.db
      .query("candidateEmbeddings")
      .withIndex("by_candidate_id", (q) => q.eq("candidateId", candidateId))
      .first();
    return !!any;
  },
});

export const hasJobEmbeddings = query({
  args: { jobId: v.optional(v.id("jobs")) },
  returns: v.boolean(),
  handler: async (ctx, { jobId }) => {
    if (!jobId) return false;
    const any = await ctx.db
      .query("jobEmbeddings")
      .withIndex("by_job_id", (q) => q.eq("jobId", jobId))
      .first();
    return !!any;
  },
});

// Wrapper action moved into openaiAction.ts to use the workpool


