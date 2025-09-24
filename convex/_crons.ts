
import { api, components, internal } from "./_generated/api";
import { Crons } from "@convex-dev/crons";
import { internalMutation, internalAction, internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { taskType } from "./types";



  
const crons = new Crons(components.crons);

export const create = mutation({
    args: {taskType: taskType, args: v.any(), name: v.string(), scheduleMs: v.number()},
    handler: async (ctx, args) => {
      try {
        await crons.register(
            ctx,
            { kind: "interval", ms: args.scheduleMs },
            api.tasks.runTask,
            { taskType: args.taskType, args: args.args, triggeredBy: "cron", triggeredById: args.name },
            args.name
          );
        return { success: true, message: "Cron created successfully" };
      } catch (error) {
        return { success: false, message: "Cron could not be created" };
      }
    },
});


export const list = query({
    args: {},
    handler: async (ctx) => {
      return await crons.list(ctx);

    },
});

export const listWithTasks = query({
    args: {},
    handler: async (ctx) => {
      const c = await crons.list(ctx);
      return Promise.all(c.map(async (cron) => ({
        ...cron,
        tasks: await ctx.db.query("tasks").filter((q) => q.eq(q.field("triggeredById"), cron.name)).collect(),
      })));

    },
});



export const get = query({
    args: { name: v.string() },
    handler: async (ctx, args) => {
      return await crons.get(ctx, { name: args.name });
    },
});
