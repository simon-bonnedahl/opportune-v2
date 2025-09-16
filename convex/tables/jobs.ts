import { defineTable } from "convex/server";
import { Infer, v } from "convex/values";

export const jobs = defineTable({
  teamtailorId: v.string(),
  teamtailorTitle: v.string(),
  orderNumber: v.optional(v.string()),

  title: v.optional(v.string()),
  companyId: v.optional(v.id("companies")),
  locations: v.array(v.string()),
  processingTask: v.optional(v.id("tasks")),
  rawData: v.any(), 

  updatedAt: v.number(),
  updatedAtTT: v.number(),
  createdAtTT: v.number(),
}).index("by_teamtailor_id", ["teamtailorId"])
.index("by_order_number", ["orderNumber"])
.searchIndex("by_teamtailor_title", { searchField: "teamtailorTitle" })
.searchIndex("by_title", { searchField: "title" });

export const jobSourceData = defineTable({
  jobId: v.id("jobs"),
  teamtailorBody: v.optional(v.any()),
  updatedAt: v.number(),
}).index("by_job_id", ["jobId"]);

export const jobProfiles = defineTable({
  jobId: v.id("jobs"),
  summary: v.string(),
  education: v.array(v.string()),
  technicalSkills: v.array(v.object({ name: v.string(), score: v.number() })),
  softSkills: v.array(v.object({ name: v.string(), score: v.number() })),
  workTasks: v.array(v.string()),
  preferences: v.array(v.string()),
  aspirations: v.array(v.string()),
  raw: v.string(),
  metadata: v.any(),
  updatedAt: v.number(),
}).index("by_job_id", ["jobId"]);

export const jobProfileSections = v.union(v.literal("summary"), v.literal("technical_skills"), v.literal("soft_skills"), v.literal("education"), v.literal("work_tasks"), v.literal("preferences"), v.literal("aspirations"));

export type JobProfileSections = Infer<typeof jobProfileSections>;

export const jobEmbeddings = defineTable({
    jobId: v.id("jobs"),
    section: jobProfileSections,
    metadata: v.optional(v.any()),
    vector: v.array(v.number()),
})
    .index("by_job_id", ["jobId"]) 
    .index("by_job_id_and_section", ["jobId", "section"])
    .vectorIndex("vector", { vectorField: "vector", dimensions: 1536 })
