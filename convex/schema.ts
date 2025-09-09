import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { role } from "./types";

export default defineSchema({
  users: defineTable({
    name: v.string(),
    email: v.string(),
    role: role,
    imageUrl: v.string(),
    externalId: v.string(),
  }).index("by_email", ["email"]).index("byExternalId", ["externalId"]),

  candidates: defineTable({
    teamtailorId: v.string(),
    name: v.string(),
    imageUrl: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    processingStatus: v.optional(v.string()),
    updatedAt: v.number(),
    // Store the full candidate data as JSON for future reference
    rawData: v.any(),
  }).index("by_teamtailor_id", ["teamtailorId"]),
  jobs: defineTable({
    teamtailorId: v.string(),
    title: v.optional(v.string()),
    status: v.optional(v.string()),
    department: v.optional(v.string()),
    location: v.optional(v.string()),
    processingStatus: v.optional(v.string()),
    updatedAt: v.number(),
    rawData: v.any(),
  }).index("by_teamtailor_id", ["teamtailorId"]),

  jobSourceData: defineTable({
    jobId: v.id("jobs"),
    body: v.optional(v.string()),
    links: v.optional(v.record(v.string(), v.string())),
    tags: v.optional(v.array(v.string())),
    recruiterEmail: v.optional(v.string()),
    remoteStatus: v.optional(v.string()),
    languageCode: v.optional(v.string()),
    mailbox: v.optional(v.string()),
    humanStatus: v.optional(v.string()),
    internal: v.optional(v.boolean()),
    createdAt: v.optional(v.number()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    updatedAt: v.number(),
  }).index("by_job_id", ["jobId"]),
  jobProfiles: defineTable({
    jobId: v.id("jobs"),
    summary: v.optional(v.string()),
    responsibilities: v.optional(v.array(v.string())),
    requirements: v.optional(v.array(v.string())),
    skills: v.optional(
      v.array(
        v.object({
          name: v.string(),
          score: v.number(),
        })
      )
    ),
    raw: v.optional(v.string()),
    metadata: v.optional(v.any()),
    updatedAt: v.number(),
  }).index("by_job_id", ["jobId"]),
  candidateSourceData: defineTable({
    candidateId: v.id("candidates"),
    assessment: v.optional(v.any()),
    hubertAnswers: v.optional(v.any()),
    cv: v.optional(v.any()),
    hubertOpenSummaryUrl: v.optional(v.string()),
    updatedAt: v.number(),
  }).index("by_candidate_id", ["candidateId"]),
  candidateProfiles: defineTable({
    candidateId: v.id("candidates"),
    summary: v.optional(v.string()),
    raw: v.optional(v.string()),
    metadata: v.optional(v.any()),
    education: v.optional(
      v.array(
        v.object({
          institution: v.optional(v.string()),
          degree: v.optional(v.string()),
          field: v.optional(v.string()),
          startDate: v.optional(v.string()),
          endDate: v.optional(v.string()),
          notes: v.optional(v.string()),
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
          company: v.optional(v.string()),
          title: v.optional(v.string()),
          startDate: v.optional(v.string()),
          endDate: v.optional(v.string()),
          responsibilities: v.optional(v.array(v.string())),
        })
      )
    ),
    updatedAt: v.number(),
  }).index("by_candidate_id", ["candidateId"]),

  // Embeddings for candidates
  candidateEmbeddings: defineTable({
    candidateId: v.id("candidates"),
    kind: v.string(), // "summary" | "skills" | "experience" | "preferences"
    text: v.string(),
    languageCode: v.optional(v.string()),
    embeddingModel: v.string(),
    embeddingDims: v.number(),
    embeddingVersion: v.number(),
    embedding: v.array(v.float64()),
    updatedAt: v.number(),
  })
    .index("by_candidate_id", ["candidateId"]) // For fast cleanup/aggregation
    .vectorIndex("by_embedding", { vectorField: "embedding", dimensions: 1536 }),

  // Embeddings for jobs
  jobEmbeddings: defineTable({
    jobId: v.id("jobs"),
    kind: v.string(), // "summary" | "requirements" | "responsibilities" | "skills"
    text: v.string(),
    languageCode: v.optional(v.string()),
    embeddingModel: v.string(),
    embeddingDims: v.number(),
    embeddingVersion: v.number(),
    embedding: v.array(v.float64()),
    updatedAt: v.number(),
  })
    .index("by_job_id", ["jobId"]) // For fast cleanup/aggregation
    .vectorIndex("by_embedding", { vectorField: "embedding", dimensions: 1536 }),

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
    workpoolName: v.string(),
    taskId: v.string(),
    workId: v.optional(v.string()),
    taskKey: v.optional(v.string()),
    taskType: v.optional(v.string()),
    fnHandle: v.string(),
    fnName: v.string(),
    fnType: v.string(),
    args: v.optional(v.any()),
    argsSummary: v.optional(v.any()),
    runAt: v.number(),
    priority: v.number(),
    status: v.string(),
    workpoolState: v.optional(v.string()),
    previousAttempts: v.optional(v.number()),
    progress: v.optional(v.number()),
    progressMessage: v.optional(v.string()),
    lastHeartbeatAt: v.optional(v.number()),
    createdAt: v.number(),
    startedAt: v.optional(v.number()),
    finishedAt: v.optional(v.number()),
    canceledAt: v.optional(v.number()),
    errorSummary: v.optional(v.string()),
    requestedBy: v.optional(v.string()),
  })
    .index("by_workpool_and_status", ["workpoolName", "status"])
    .index("by_workpool_type_and_status", ["workpoolName", "taskType", "status"])
    .index("by_type_and_status", ["taskType", "status"])
    .index("by_runAt", ["runAt"])
    .index("by_taskId", ["taskId"])
    .index("by_workId", ["workId"]),
});
