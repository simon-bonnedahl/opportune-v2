import { cosineSimilarity, embedMany, generateObject, generateText, LanguageModel } from 'ai';
import { query, mutation, internalMutation, action, internalAction } from './_generated/server';
import { paginationOptsValidator } from 'convex/server';
import { ConvexError, v } from 'convex/values';
import { Id } from './_generated/dataModel';
import { enqueueTask } from './tasks';
  import { models } from '../src/config/models';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
export const getModel = (modelId: string) => {
  return models.find((m) => m.id === modelId)?.model;
}
export const getProvider = (modelId: string) => {
  return models.find((m) => m.id === modelId)?.provider;
}

const checkIfModelIsEnabled = (modelId: string) => {
  const model = models.find((m) => m.id === modelId);
  if (!model) {
    throw new Error(`Model '${modelId}' not found`);
  }
  return model.enabled;
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

        // Helper function to safely get embedding similarity
        const getSimilarity = (jobSection: string, candidateSection: string) => {
            const jobEmbedding = getEmbeddingSection(jobEmbeddings, jobSection);
            const candidateEmbedding = getEmbeddingSection(candidateEmbeddings, candidateSection);
            
            if (!jobEmbedding || !candidateEmbedding) {
                return 0;
            }
            
            return cosineSimilarity(jobEmbedding.vector, candidateEmbedding.vector);
        };

        // Calculate individual scores
        const summaryScore = getSimilarity("summary", "summary");
        const technicalSkillsScore = getSimilarity("technical_skills", "technical_skills");
        const softSkillsScore = getSimilarity("soft_skills", "soft_skills");
        const educationScore = getSimilarity("education", "education");
        const workTasksScore = getSimilarity("work_tasks", "work_experience");
        const preferencesScore = getSimilarity("preferences", "preferences");
        const aspirationsScore = getSimilarity("aspirations", "aspirations");

        // Enhanced scoring with weighted importance and penalties
        const weights = {
            summary: 0.15,
            technicalSkills: 0.25,
            softSkills: 0.15,
            education: 0.20, // Increased weight for education
            workTasks: 0.15,
            preferences: 0.05,
            aspirations: 0.05
        };

        // Apply penalties for critical sections that are too low
        const criticalThresholds = {
            technicalSkills: 0.3,
            education: 0.25, // Lower threshold for education
            workTasks: 0.2
        };

        let weightedScore = 0;
        let totalWeight = 0;

        // Calculate weighted score with penalties
        const sections = [
            { name: 'summary', score: summaryScore, weight: weights.summary },
            { name: 'technicalSkills', score: technicalSkillsScore, weight: weights.technicalSkills, critical: true },
            { name: 'softSkills', score: softSkillsScore, weight: weights.softSkills },
            { name: 'education', score: educationScore, weight: weights.education, critical: true },
            { name: 'workTasks', score: workTasksScore, weight: weights.workTasks, critical: true },
            { name: 'preferences', score: preferencesScore, weight: weights.preferences },
            { name: 'aspirations', score: aspirationsScore, weight: weights.aspirations }
        ];

        for (const section of sections) {
            let adjustedScore = section.score;
            
            // Apply penalty for critical sections below threshold
            if (section.critical && criticalThresholds[section.name as keyof typeof criticalThresholds]) {
                const threshold = criticalThresholds[section.name as keyof typeof criticalThresholds];
                if (section.score < threshold) {
                    // Apply exponential penalty but don't completely zero it out
                    adjustedScore = section.score * Math.pow(section.score / threshold, 1.5);
                }
            }
            
            weightedScore += adjustedScore * section.weight;
            totalWeight += section.weight;
        }

        // Normalize by total weight and apply final boost for good education matches
        const finalAverageScore = totalWeight > 0 ? weightedScore / totalWeight : 0;
        
        // Boost education score if it's particularly good (>0.6) since education is often critical
        const educationBoost = educationScore > 0.6 ? (educationScore - 0.6) * 0.3 : 0;
        const boostedAverageScore = Math.min(finalAverageScore + educationBoost, 1.0);

        const scores = { 
            averageScore: Math.round(boostedAverageScore * 1000) / 1000,
            summaryScore: Math.round(summaryScore * 1000) / 1000,
            technicalSkillsScore: Math.round(technicalSkillsScore * 1000) / 1000,
            softSkillsScore: Math.round(softSkillsScore * 1000) / 1000,
            educationScore: Math.round(educationScore * 1000) / 1000,
            workTasksScore: Math.round(workTasksScore * 1000) / 1000,
            preferencesScore: Math.round(preferencesScore * 1000) / 1000,
            aspirationsScore: Math.round(aspirationsScore * 1000) / 1000
        };
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
                job: jobProfile.softSkills,
                candidate: candidateProfile.softSkills,
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
            .withIndex("by_candidate_and_job", (q) => 
                q.eq("candidateId", candidateId).eq("jobId", jobId)
            )
            .order("desc")
            .collect();

        return matches;
    }
});



// Get matches for a specific job with pagination, search, and filtering
export const getJobMatches = query({
    args: {
        jobId: v.id("jobs"),
        paginationOpts: paginationOptsValidator,
        search: v.optional(v.string()),
        sortBy: v.optional(v.union(v.literal("score"), v.literal("updatedAt"), v.literal("candidateName"))),
        sortOrder: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
        model: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const { jobId, paginationOpts, search, sortBy = "score", sortOrder = "desc", model } = args;
        
        // Start with matches for this job
        let query = ctx.db.query("matches").withIndex("by_job", (q) => q.eq("jobId", jobId));
        
        
        if (model) {
            query = query.filter((q) => q.eq(q.field("model"), model));
        }
        
        // Get ALL matches first for proper sorting
        const allMatches = await query.collect();
        
        // Get candidate names for search filtering
        let filteredMatches = allMatches;
        if (search && search.trim()) {
            const searchLower = search.toLowerCase().trim();
            const allCandidates = await ctx.db.query("candidates").collect();
            const candidateNameMap = new Map(allCandidates.map(candidate => [candidate._id, (candidate.name || "").toLowerCase()]));
            
            filteredMatches = allMatches.filter(match => {
                const candidateName = candidateNameMap.get(match.candidateId) || "";
                return candidateName.includes(searchLower);
            });
        }
        
        // Apply sorting to ALL filtered matches
        let sortedMatches = filteredMatches;
        if (sortBy === "score" || sortBy === "updatedAt") {
            sortedMatches = [...filteredMatches].sort((a, b) => {
                const aValue = sortBy === "score" ? a.score : a.updatedAt;
                const bValue = sortBy === "score" ? b.score : b.updatedAt;
                return sortOrder === "asc" ? aValue - bValue : bValue - aValue;
            });
        }
        
        // Apply manual pagination to sorted results
        const startIndex = paginationOpts.cursor ? parseInt(paginationOpts.cursor) : 0;
        const endIndex = startIndex + paginationOpts.numItems;
        const paginatedMatches = sortedMatches.slice(startIndex, endIndex);
        
        // Enrich matches with job and candidate details
        const enrichedMatches = await Promise.all(
            paginatedMatches.map(async (match) => {
                const candidate = await ctx.db.get(match.candidateId);
                
                return {
                    ...match,
                    candidate: candidate ? {
                        _id: candidate._id,
                        name: candidate.name,
                        _creationTime: candidate._creationTime,
                    } : null,
                };
            })
        );
        
        return {
            page: enrichedMatches,
            isDone: endIndex >= sortedMatches.length,
            continueCursor: endIndex < sortedMatches.length ? endIndex.toString() : "",
        };
    }
});

// Get matches for a specific candidate with pagination, search, and filtering
export const getCandidateMatches = query({
    args: {
        candidateId: v.id("candidates"),
        paginationOpts: paginationOptsValidator,
        search: v.optional(v.string()),
        sortBy: v.optional(v.union(v.literal("score"), v.literal("updatedAt"), v.literal("jobTitle"))),
        sortOrder: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
        model: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const { candidateId, paginationOpts, search, sortBy = "score", sortOrder = "desc", model } = args;
        
        // Start with matches for this candidate
        let query = ctx.db.query("matches").withIndex("by_candidate", (q) => q.eq("candidateId", candidateId));
        
        
        
        if (model) {
            query = query.filter((q) => q.eq(q.field("model"), model));
        }
        
        // Get ALL matches first for proper sorting
        const allMatches = await query.collect();
        
        // Get job titles for search filtering
        let filteredMatches = allMatches;
        if (search && search.trim()) {
            const searchLower = search.toLowerCase().trim();
            const allJobs = await ctx.db.query("jobs").collect();
            const jobTitleMap = new Map(allJobs.map(job => [job._id, (job.title || job.teamtailorTitle || "").toLowerCase()]));
            
            filteredMatches = allMatches.filter(match => {
                const jobTitle = jobTitleMap.get(match.jobId) || "";
                return jobTitle.includes(searchLower);
            });
        }
        
        // Apply sorting to ALL filtered matches
        let sortedMatches = filteredMatches;
        if (sortBy === "score" || sortBy === "updatedAt") {
            sortedMatches = [...filteredMatches].sort((a, b) => {
                const aValue = sortBy === "score" ? a.score : a.updatedAt;
                const bValue = sortBy === "score" ? b.score : b.updatedAt;
                return sortOrder === "asc" ? aValue - bValue : bValue - aValue;
            });
        }
        
        // Apply manual pagination to sorted results
        const startIndex = paginationOpts.cursor ? parseInt(paginationOpts.cursor) : 0;
        const endIndex = startIndex + paginationOpts.numItems;
        const paginatedMatches = sortedMatches.slice(startIndex, endIndex);
        
        // Enrich matches with job and candidate data
        const enrichedMatches = await Promise.all(
            paginatedMatches.map(async (match) => {
                return {
                    ...match,
                    job: await ctx.db.get(match.jobId),
                };
            })
        );
        
        return {
            page: enrichedMatches,
            isDone: endIndex >= sortedMatches.length,
            continueCursor: endIndex < sortedMatches.length ? endIndex.toString() : "",
        };
    }
});


const MATCH_PROMPT = `
You are an expert candidate–job matching engine.
Given a structured Candidate Profile and Job Profile, compute a suitability score between 0.0 and 1.0.
All text should be in Swedish.
You will be given a set of scoring guidelines to follow below.

Scoring Guidelines:

{{scoringGuidelines}}

Candidate Profile:

{{candidateProfile}}

Job Profile:

{{jobProfile}}


The match should be a JSON object with the following fields:
- score: a score between 0.0 and 1.0
- explanation: a concise explanation of the match
- confidence: a score between 1-10 indicating how strong the input data is for building a good match (10 = excellent data quality, 1 = very poor data quality)

The response should be in the following format:
{
  "score": "number",
  "explanation": "string",
  "confidence": "number"
}

Return only the JSON object.
Do not include any other text or comments.
`;


export const match = internalAction({
  args: { candidateProfile: v.any(), jobProfile: v.any(), scoringGuidelines: v.string(), model: v.string() },
  handler: async (ctx, args) => {
    const { candidateProfile, jobProfile, scoringGuidelines } = args;
    if (!checkIfModelIsEnabled(args.model)) {
      throw new ConvexError(`Model '${args.model}' is disabled by admin`);
    }
    const model = getModel(args.model) ?? openai('gpt-5');
    const provider = getProvider(args.model) ?? "OpenAI";
    const prompt = MATCH_PROMPT.replace("{{scoringGuidelines}}", scoringGuidelines).replace("{{candidateProfile}}", JSON.stringify(candidateProfile)).replace("{{jobProfile}}", JSON.stringify(jobProfile));
    const response = await generateObject({
      model,
      schema: z.object({
        score: z.number(),
        explanation: z.string(),
        confidence: z.number(),
      }),
      prompt,
    });
    return { metadata: { modelId: model.modelId, provider, totalUsage: response.usage, prompt, confidence: response.object.confidence }, raw: response.object, response: response.object };
  
  }
});
