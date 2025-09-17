import { Infer, v } from "convex/values";

export const role = v.union(
    v.literal("TA"),
    v.literal("BM"),
    v.literal("AM"),
    v.literal("ADMIN"),
  );
  
  export type Role = Infer<typeof role>;


export const taskType = v.union(
    v.literal("import"),
    v.literal("build_profile"),
    v.literal("embed_profile"),
    v.literal("match"),
  );

export const taskStatus = v.union(
    v.literal("queued"),
    v.literal("running"),
    v.literal("succeeded"),
    v.literal("failed"),
    v.literal("canceled"),
  );
  
  export type TaskType = Infer<typeof taskType>;