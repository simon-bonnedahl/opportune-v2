
import { components, internal } from "./_generated/api";
import { Crons } from "@convex-dev/crons";
import { internalMutation, mutation } from "./_generated/server";
import { v } from "convex/values";


export const logStuff = internalMutation({
    args: {
      message: v.string(),
    },
    handler: async (_ctx, args) => {
      console.log(args.message);
    },
  });

  
  
const crons = new Crons(components.crons);
export const create = mutation({
    args: {message: v.string()},
    handler: async (ctx, args) => {
        const namedCronId = await crons.register(
            ctx,
            { kind: "interval", ms: 3600000 },
            internal.cronz.logStuff,
            { message: args.message },
            "hourly-test"
          );
      
    },
});
        