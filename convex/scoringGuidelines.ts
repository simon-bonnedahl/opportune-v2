import { v } from "convex/values";
import { query } from "./_generated/server";


export const get = query({
    args: {
        scoringGuidelineId: v.id("scoringGuidelines"),
    },
    handler: async (ctx, { scoringGuidelineId }) => {
        return await ctx.db.get(scoringGuidelineId);
    }
});

export const list = query({
    args: {},
    handler: async (ctx, args) => {
        return await ctx.db.query("scoringGuidelines").collect();
    }
});
