import { defineTable } from "convex/server";
import { Infer, v } from "convex/values";


export const candidates = defineTable({
    teamtailorId: v.string(),
    name: v.string(),
    imageUrl: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    linkedinUrl: v.optional(v.string()),
    rawData: v.any(),
    processingTask: v.optional(v.id("tasks")),
    updatedAt: v.number(),
    updatedAtTT: v.number(),
    createdAtTT: v.number(),
}).index("by_teamtailor_id", ["teamtailorId"]).searchIndex("by_name", { searchField: "name" });


export const candidateSourceData = defineTable({
    candidateId: v.id("candidates"),
    assessment: v.optional(v.object({
        comment: v.string(),
        rating: v.number(),
        createdAt: v.string(),
    })),
    hubertAnswers: v.optional(v.string()),
    hubertUrl: v.optional(v.string()),
    resumeSummary: v.optional(v.string()),
    linkedinSummary: v.optional(v.string()),
    updatedAt: v.number(),
}).index("by_candidate_id", ["candidateId"])



export const candidateProfiles = defineTable({
    candidateId: v.id("candidates"),
    raw: v.string(),
    metadata: v.any(),
    description: v.string(),
    summary: v.string(),
    technicalSkills:
        v.array(
            v.object({
                name: v.string(),
                score: v.number(),
            })
        )
    ,
    softSkills: v.array(v.string()),
    education: v.array(v.string()),
    workExperience: v.array(v.string()),
    preferences: v.array(v.string()),
    aspirations: v.array(v.string()),
    updatedAt: v.number(),
}).index("by_candidate_id", ["candidateId"])


export const candidateProfileSections = v.union(v.literal("summary"), v.literal("technical_skills"), v.literal("soft_skills"), v.literal("education"), v.literal("work_experience"), v.literal("preferences"), v.literal("aspirations"));

export type CandidateProfileSections = Infer<typeof candidateProfileSections>;

export const candidateEmbeddings = defineTable({
    candidateId: v.id("candidates"),
    section: candidateProfileSections,
    metadata: v.optional(v.any()),
    vector: v.array(v.number()),
    updatedAt: v.number(),
})
    .index("by_candidate_id", ["candidateId"])
    .index("by_candidate_id_and_section", ["candidateId", "section"])
    .index("by_section", ["section"])
    .vectorIndex("vector", { vectorField: "vector", dimensions: 1536 })


export const candidateTTCache = defineTable({
    teamtailorId: v.string(),
    candidateId: v.optional(v.id("candidates")),
    name: v.string(),
    email: v.optional(v.string()),
    hasAssessment: v.boolean(),
    hasHubert: v.boolean(),
    hasResumeSummary: v.boolean(),
    hasLinkedinSummary: v.boolean(),
    updatedAt: v.number(),
    createdAt: v.number(),
}).index("by_candidate_id", ["candidateId"]).index("by_teamtailor_id", ["teamtailorId"]).searchIndex("by_name", { searchField: "name" }).index("by_has_assessment", ["hasAssessment"]).index("by_has_hubert", ["hasHubert"]).index("by_has_resume_summary", ["hasResumeSummary"])