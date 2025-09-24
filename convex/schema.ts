import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { role, taskStatus } from "./types";
import { candidateProfiles, candidateEmbeddings, candidates, candidateSourceData, candidateTTCache } from "./tables/candidates";
import { jobs, jobSourceData, jobProfiles, jobEmbeddings, jobTTCache } from "./tables/jobs";

export default defineSchema({
  users: defineTable({
    name: v.string(),
    email: v.string(),
    role: role,
    imageUrl: v.string(),
    externalId: v.string(),
  }).index("by_email", ["email"]).index("byExternalId", ["externalId"]).index("by_role", ["role"]).searchIndex("by_name", { searchField: "name" }),

  candidates: candidates,
  candidateSourceData: candidateSourceData,
  candidateProfiles: candidateProfiles,
  candidateEmbeddings: candidateEmbeddings,
  candidateTTCache: candidateTTCache,
  jobs: jobs,
  jobSourceData: jobSourceData,
  jobProfiles: jobProfiles,
  jobEmbeddings: jobEmbeddings,
  jobTTCache: jobTTCache,

  companies: defineTable({
    name: v.string(),
    imageUrl: v.optional(v.string()),
    locations: v.array(v.string()),
    updatedAt: v.number(),
  }).searchIndex("by_name", { searchField: "name" }),

  matches: defineTable({
    candidateId: v.id("candidates"),
    scoringGuidelineId: v.id("scoringGuidelines"),
    jobId: v.id("jobs"),
    model: v.string(),
    score: v.float64(),
    explanation: v.optional(v.string()),
    metadata: v.any(),
    updatedAt: v.number(),
  })
    .index("by_candidate", ["candidateId"])
    .index("by_job", ["jobId"])
    .index("by_model", ["model"])
    .index("by_score", ["score"])
    .index("by_candidate_and_job", ["candidateId", "jobId"]) 
    .index("by_candidate_job_model", ["candidateId", "jobId", "model"]),

  scoringGuidelines: defineTable({
    name: v.string(),
    text: v.string(),
    createdBy: v.id("users"),
  }).index("by_created_by", ["createdBy"]),

  tasks: defineTable({
    workpool: v.string(),
    type: v.string(),
    triggeredBy: v.union(v.literal("user"), v.literal("task"), v.literal("cron")),
    triggeredById: v.optional(v.union(v.id("users"), v.id("tasks"), v.string())),
    args: v.optional(v.any()),
    status: taskStatus,
    attempts: v.number(),
    progress: v.number(),
    progressMessages: v.array(v.object({
      message: v.string(),
      timestamp: v.number(),
    })),
    errorMessage: v.optional(v.string()),
    queuedAt: v.number(),
    runAt: v.optional(v.number()),
    stoppedAt: v.optional(v.number()),
    metadata: v.optional(v.any()),
  })
    .index("by_workpool_and_status", ["workpool", "status"])
    .index("by_workpool_type_and_status", ["workpool", "type", "status"])
    .index("by_type_and_status", ["type", "status"])
    .index("by_runAt", ["runAt"])
    .index("by_workpool_status_queuedAt", ["workpool", "status", "queuedAt"]) 
    .index("by_workpool_status_stoppedAt", ["workpool", "status", "stoppedAt"]),

});
