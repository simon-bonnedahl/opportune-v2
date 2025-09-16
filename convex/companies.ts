import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { internalMutation, query } from "./_generated/server";


export const connectOrCreate = internalMutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const company = await ctx.db.query("companies").withSearchIndex("by_name", (q) => q.search("name", args.name)).first();
    if (company) return company._id;
    const companyId = await ctx.db.insert("companies", { name: args.name, updatedAt: Date.now(), locations: [] });
    return companyId;
  },
});


export const create = internalMutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db.insert("companies", { name: args.name, updatedAt: Date.now(), locations: [] });
   
  },
});



//API Actions
export const getByName = query({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db.query("companies").withSearchIndex("by_name", (q) => q.search("name", args.name)).first();
  },
});


