import { v } from "convex/values";
import { query, mutation } from "./_generated/server";


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

export const create = mutation({
    args: {
        name: v.string(),
        text: v.string(),
    },
    handler: async (ctx, { name, text }) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }

        const user = await ctx.db
            .query("users")
            .withIndex("by_email", (q) => q.eq("email", identity.email!))
            .first();

        if (!user) {
            throw new Error("User not found");
        }

        return await ctx.db.insert("scoringGuidelines", {
            name,
            text,
            createdBy: user._id,
        });
    }
});

export const update = mutation({
    args: {
        id: v.id("scoringGuidelines"),
        name: v.string(),
        text: v.string(),
    },
    handler: async (ctx, { id, name, text }) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }

        const user = await ctx.db
            .query("users")
            .withIndex("by_email", (q) => q.eq("email", identity.email!))
            .first();

        if (!user) {
            throw new Error("User not found");
        }

        const guideline = await ctx.db.get(id);
        if (!guideline) {
            throw new Error("Scoring guideline not found");
        }

        // if (guideline.createdBy !== user._id) {
        //     throw new Error("Not authorized to update this scoring guideline");
        // }

        return await ctx.db.patch(id, {
            name,
            text,
        });
    }
});

export const remove = mutation({
    args: {
        id: v.id("scoringGuidelines"),
    },
    handler: async (ctx, { id }) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }

        const user = await ctx.db
            .query("users")
            .withIndex("by_email", (q) => q.eq("email", identity.email!))
            .first();

        if (!user) {
            throw new Error("User not found");
        }

        const guideline = await ctx.db.get(id);
        if (!guideline) {
            throw new Error("Scoring guideline not found");
        }

        if (guideline.createdBy !== user._id) {
            throw new Error("Not authorized to delete this scoring guideline");
        }

        return await ctx.db.delete(id);
    }
});
