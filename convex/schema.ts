import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { role, taskStatus } from "./types";
import { candidateProfiles, candidateEmbeddings, candidates, candidateSourceData } from "./tables/candidates";
import { jobs, jobSourceData, jobProfiles, jobEmbeddings } from "./tables/jobs";

export default defineSchema({
  users: defineTable({
    name: v.string(),
    email: v.string(),
    role: role,
    imageUrl: v.string(),
    externalId: v.string(),
  }).index("by_email", ["email"]).index("byExternalId", ["externalId"]),

  candidates: candidates,
  candidateSourceData: candidateSourceData,
  candidateProfiles: candidateProfiles,
  candidateEmbeddings: candidateEmbeddings,
  jobs: jobs,
  jobSourceData: jobSourceData,
  jobProfiles: jobProfiles,
  jobEmbeddings: jobEmbeddings,

  // Candidate ↔ Job match results
  matches: defineTable({
    candidateId: v.id("candidates"),
    jobId: v.id("jobs"),
    model: v.optional(v.string()), // temporarily optional for backfill
    score: v.number(),
    explanation: v.optional(v.string()),
    metadata: v.optional(v.any()),
    updatedAt: v.number(),
  })
    .index("by_candidate", ["candidateId"])
    .index("by_job", ["jobId"])
    .index("by_candidate_and_job", ["candidateId", "jobId"]) // legacy index kept for compatibility
    .index("by_candidate_job_model", ["candidateId", "jobId", "model"]),
  // Tasks tracking for fine-grained monitoring and queue control
  tasks: defineTable({
    workpool: v.string(),
    type: v.string(),
    triggeredBy: v.union(v.literal("user"), v.literal("task"), v.literal("cron"), v.literal("system")),
    triggeredById: v.optional(v.union(v.id("users"), v.id("tasks"))),
    args: v.optional(v.any()),
    status: taskStatus,
    attempts: v.number(),
    progress: v.number(),
    progressMessage: v.optional(v.string()),
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
