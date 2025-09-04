import { Infer, v } from "convex/values";

export const role = v.union(
    v.literal("USER"),
    v.literal("ADMIN"),
  );
  
  export type Role = Infer<typeof role>;