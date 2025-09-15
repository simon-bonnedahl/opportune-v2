import { defineTable } from "convex/server";
import { v } from "convex/values";

export const jobs = defineTable({
  teamtailorId: v.string(),
  title: v.optional(v.string()),
  company: v.optional(v.string()),
  location: v.optional(v.string()),
  processingTask: v.optional(v.id("tasks")),
  rawData: v.any(), 

  updatedAt: v.number(),
  updatedAtTT: v.number(),
  createdAtTT: v.number(),
}).index("by_teamtailor_id", ["teamtailorId"]);

export const jobSourceData = defineTable({
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
}).index("by_job_id", ["jobId"]);

export const jobProfiles = defineTable({
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
}).index("by_job_id", ["jobId"]);

export const jobEmbeddings = defineTable({
  jobId: v.id("jobs"),
  section: v.union(v.literal("summary"), v.literal("requirements"), v.literal("responsibilities"), v.literal("technical_skills"), v.literal("soft_skills")),
  text: v.string(),
  languageCode: v.optional(v.string()),
  embeddingModel: v.string(),
  embeddingDims: v.number(),
  embeddingVersion: v.number(),
  vector: v.array(v.number()),
})
  .index("by_job_id", ["jobId"]) 
  .vectorIndex("vector", { vectorField: "vector", dimensions: 1536 });
