import { cosineSimilarity, embedMany } from 'ai';
import { query, mutation, internalMutation, action } from './_generated/server';
import { v } from 'convex/values';
import { Id } from './_generated/dataModel';
import { enqueueTask } from './tasks';

const models = {
  openai: {
    gpt5: {
      modelId: "gpt-5",
      config: {
        temperature: 0.0,
        maxTokens: 1000,
      },
    },
    gpt4o: {
      modelId: "gpt-4o",
      config: {
        temperature: 0.0,
        maxTokens: 1000,
      },
    }
  },
  google: {
    gemini: {
      modelId: "gemini-2.0-flash",
      config: {
        temperature: 0.0,
        maxTokens: 1000,
      },
    }
  },
  anthropic: {
    claude4sonnet: {
      modelId: "claude-4-sonnet-20240229",
      config: {
        temperature: 0.0,
        maxTokens: 1000,
      },
    }
  }
}
//Helpers
const getEmbeddingSection = (embeddings: any[], section: string) => {
    return embeddings.find((e) => e.section === section);
}


//Internals
export const create = internalMutation({
  args: {
      jobId: v.id("jobs"),
      candidateId: v.id("candidates"),
      scoringGuidelineId: v.id("scoringGuidelines"),
      model: v.string(),
      score: v.float64(),
      explanation: v.optional(v.string()),
      metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
      const matchId = await ctx.db.insert("matches", {
          candidateId: args.candidateId,
          scoringGuidelineId: args.scoringGuidelineId,
          jobId: args.jobId,
          model: args.model,
          score: args.score,
          explanation: args.explanation,
          metadata: args.metadata,
          updatedAt: Date.now(),
      });

      return matchId;
  }
});

export const enqueueMatch = action({
  args: {
    jobId: v.id("jobs"),
    candidateId: v.id("candidates"),
    scoringGuidelineId: v.id("scoringGuidelines"),
    model: v.string(),
  },
  handler: async (ctx, { jobId, candidateId, model, scoringGuidelineId }): Promise<{ taskId: Id<"tasks"> }> => {
     const { taskId } = await enqueueTask(ctx, "match", "user", { jobId, candidateId, model, scoringGuidelineId });
     return { taskId };
  }
});



export const getMatchScores = query({
    args: {
        jobId: v.id("jobs"),
        candidateId: v.id("candidates"),
    },
    handler: async (ctx, { jobId, candidateId }) => {
        const jobEmbeddings = await ctx.db.query("jobEmbeddings").withIndex("by_job_id", (q) => q.eq("jobId", jobId)).collect();
        const candidateEmbeddings = await ctx.db.query("candidateEmbeddings").withIndex("by_candidate_id", (q) => q.eq("candidateId", candidateId)).collect();
        if (jobEmbeddings.length === 0 || candidateEmbeddings.length === 0) {
            return { averageScore: 0, summaryScore: 0, technicalSkillsScore: 0, softSkillsScore: 0, educationScore: 0, workTasksScore: 0, preferencesScore: 0, aspirationsScore: 0 };
        }
        const summaryScore = cosineSimilarity(getEmbeddingSection(jobEmbeddings, "summary").vector, getEmbeddingSection(candidateEmbeddings, "summary").vector);
        const technicalSkillsScore = cosineSimilarity(getEmbeddingSection(jobEmbeddings, "technical_skills").vector, getEmbeddingSection(candidateEmbeddings, "technical_skills").vector);
        const softSkillsScore = cosineSimilarity(getEmbeddingSection(jobEmbeddings, "soft_skills").vector, getEmbeddingSection(candidateEmbeddings, "soft_skills").vector);
        const educationScore = cosineSimilarity(getEmbeddingSection(jobEmbeddings, "education").vector, getEmbeddingSection(candidateEmbeddings, "education").vector);
        const workTasksScore = cosineSimilarity(getEmbeddingSection(jobEmbeddings, "work_tasks").vector, getEmbeddingSection(candidateEmbeddings, "work_experience").vector);
        const preferencesScore = cosineSimilarity(getEmbeddingSection(jobEmbeddings, "preferences").vector, getEmbeddingSection(candidateEmbeddings, "preferences").vector);
        const aspirationsScore = cosineSimilarity(getEmbeddingSection(jobEmbeddings, "aspirations").vector, getEmbeddingSection(candidateEmbeddings, "aspirations").vector);
        const averageScore = (summaryScore + technicalSkillsScore + softSkillsScore + educationScore + workTasksScore + preferencesScore + aspirationsScore) / 7;
        const scores = { averageScore, summaryScore, technicalSkillsScore, softSkillsScore, educationScore, workTasksScore, preferencesScore, aspirationsScore };
        return scores;
    }
});

// Get section details for a specific score category
export const getSectionDetails = query({
    args: {
        jobId: v.id("jobs"),
        candidateId: v.id("candidates"),
        section: v.union(
            v.literal("summary"),
            v.literal("technical_skills"),
            v.literal("soft_skills"),
            v.literal("education"),
            v.literal("work_tasks"),
            v.literal("work_experience"),
            v.literal("preferences"),
            v.literal("aspirations")
        ),
    },
    handler: async (ctx, { jobId, candidateId, section }) => {
        // Get job profile
        const jobProfile = await ctx.db.query("jobProfiles").withIndex("by_job_id", (q) => q.eq("jobId", jobId)).first();
        if (!jobProfile) return null;

        // Get candidate profile
        const candidateProfile = await ctx.db.query("candidateProfiles").withIndex("by_candidate_id", (q) => q.eq("candidateId", candidateId)).first();
        if (!candidateProfile) return null;

        // Map sections to their data
        const sectionMapping = {
            summary: {
                job: jobProfile.summary,
                candidate: candidateProfile.summary,
                isArray: false,
            },
            technical_skills: {
                job: jobProfile.technicalSkills.map(skill => skill.name),
                candidate: candidateProfile.technicalSkills.map(skill => skill.name),
                isArray: true,
            },
            soft_skills: {
                job: jobProfile.softSkills.map(skill => skill.name),
                candidate: candidateProfile.softSkills.map(skill => skill.name),
                isArray: true,
            },
            education: {
                job: jobProfile.education,
                candidate: candidateProfile.education,
                isArray: true,
            },
            work_tasks: {
                job: jobProfile.workTasks,
                candidate: candidateProfile.workExperience,
                isArray: true,
            },
            work_experience: {
                job: jobProfile.workTasks,
                candidate: candidateProfile.workExperience,
                isArray: true,
            },
            preferences: {
                job: jobProfile.preferences,
                candidate: candidateProfile.preferences,
                isArray: true,
            },
            aspirations: {
                job: jobProfile.aspirations,
                candidate: candidateProfile.aspirations,
                isArray: true,
            },
        };

        return sectionMapping[section] || null;
    }
});

// Get previous matches for a candidate and job combination
export const getPreviousMatches = query({
    args: {
        jobId: v.id("jobs"),
        candidateId: v.id("candidates"),
    },
    handler: async (ctx, { jobId, candidateId }) => {
        const matches = await ctx.db.query("matches")
            .withIndex("by_candidate_job_model", (q) => 
                q.eq("candidateId", candidateId).eq("jobId", jobId)
            )
            .order("desc")
            .collect();

        return matches;
    }
});

