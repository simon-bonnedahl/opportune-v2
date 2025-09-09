import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { vWorkIdValidator, Workpool } from "@convex-dev/workpool";
import { internal, components } from "./_generated/api";
import { buildPool, embedPool, importPool, matchPool } from "./workpools";

type EnqueueTrackedOptions = {
  workpoolName: string;
  priority?: number; // higher runs earlier in our UI semantics
  runAt?: number; // override schedule time; defaults to now
  requestedBy?: string;
  argsSummary?: unknown;
  taskKey?: string; // optional stable key for dedupe or grouping
  taskType?: string; // e.g. import|build_profile|embed|match
};

function generateTrackingId(): string {
  // Simple, readable unique id
  const rand = Math.random().toString(36).slice(2, 10);
  return `${Date.now()}-${rand}`;
}

// Result validator for onComplete
const resultValidator = v.union(
  v.object({ kind: v.literal("success"), returnValue: v.optional(v.any()) }),
  v.object({ kind: v.literal("failed"), error: v.any() }),
  v.object({ kind: v.literal("canceled") })
);

export const onComplete = internalMutation({
  args: {
    workId: vWorkIdValidator,
    result: resultValidator,
    context: v.object({ taskId: v.string() }),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { taskId } = args.context;
    const row = await ctx.db
      .query("tasks")
      .withIndex("by_taskId", (q) => q.eq("taskId", taskId))
      .unique();
    if (!row) return null;

    // Derive final status from result
    let status: string = row.status;
    let errorSummary: string | undefined;
    // If a cancel was requested, prefer marking as canceled regardless of result
    const wasCancelRequested = row.status === "cancelRequested";
    if (args.result.kind === "success") {
      status = wasCancelRequested ? "canceled" : "succeeded";
    } else if (args.result.kind === "failed") {
      status = wasCancelRequested ? "canceled" : "failed";
      try {
        errorSummary = typeof args.result.error === "string" ? args.result.error : JSON.stringify(args.result.error);
      } catch {
        errorSummary = "unknown error";
      }
    } else if (args.result.kind === "canceled") {
      status = "canceled";
    }

    await ctx.db.patch(row._id, {
      status,
      errorSummary,
      workpoolState: "finished",
      finishedAt: Date.now(),
    });

    // If a build_profile task completed successfully, enqueue embeddings in the embed workpool
    try {
      if (status === "succeeded" && row.taskType === "build_profile") {
        const argsObj: any = (row.argsSummary ?? row.args ?? {}) as any;
        const candidateId = argsObj.candidateId;
        const jobId = argsObj.jobId;
        const pool = getPoolForTaskType("embed");
        if (candidateId) {
          await enqueueTrackedAction(
            ctx,
            pool,
            internal.openaiAction.buildCandidateEmbeddingsWrapper,
            { candidateId },
            {
              workpoolName: "embed",
              taskType: "embed",
              priority: 0,
              runAt: Date.now(),
              requestedBy: row.requestedBy ?? "system",
              argsSummary: { candidateId },
            }
          );
        } else if (jobId) {
          await enqueueTrackedAction(
            ctx,
            pool,
            internal.openaiAction.buildJobEmbeddingsWrapper,
            { jobId },
            {
              workpoolName: "embed",
              taskType: "embed",
              priority: 0,
              runAt: Date.now(),
              requestedBy: row.requestedBy ?? "system",
              argsSummary: { jobId },
            }
          );
        }
      }
      // If a cv_summarize task completed successfully, chain build_profile
      if (status === "succeeded" && row.taskType === "cv_summarize") {
        const argsObj: any = (row.argsSummary ?? row.args ?? {}) as any;
        const candidateId = argsObj.candidateId;
        if (candidateId) {
          const pool = getPoolForTaskType("build_profile");
          await enqueueTrackedAction(
            ctx,
            pool,
            internal.openaiAction.buildProfile,
            { candidateId },
            {
              workpoolName: "build",
              taskType: "build_profile",
              priority: 0,
              runAt: Date.now(),
              requestedBy: row.requestedBy ?? "system",
              argsSummary: { candidateId },
            }
          );
        }
      }
    } catch (e) {
      // Best-effort follow-on enqueue; ignore failures here
    }
    return null;
  },
});

export const markStarted = internalMutation({
  args: { taskId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("tasks")
      .withIndex("by_taskId", (q) => q.eq("taskId", args.taskId))
      .unique();
    if (!row) return null;
    if (row.status === "running") return null;
    await ctx.db.patch(row._id, {
      status: "running",
      workpoolState: "running",
      startedAt: Date.now(),
    });
    return null;
  },
});

export const updateProgress = internalMutation({
  args: { taskId: v.string(), progress: v.number(), message: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("tasks")
      .withIndex("by_taskId", (q) => q.eq("taskId", args.taskId))
      .unique();
    if (!row) return null;
    await ctx.db.patch(row._id, {
      progress: Math.max(0, Math.min(100, args.progress)),
      progressMessage: args.message,
      lastHeartbeatAt: Date.now(),
    });
    return null;
  },
});

export const shouldCancel = internalQuery({
  args: { taskId: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("tasks")
      .withIndex("by_taskId", (q) => q.eq("taskId", args.taskId))
      .unique();
    return row ? row.status === "cancelRequested" : false;
  },
});

// Create workpools once per module load and reuse


function getPoolForName(name: string): Workpool | null {
  if (name === "import") return importPool;
  if (name === "build") return buildPool;
  if (name === "embed") return embedPool;
  if (name === "match") return matchPool;
  return null;
}

export const requestCancel = mutation({
  args: { taskId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("tasks")
      .withIndex("by_taskId", (q) => q.eq("taskId", args.taskId))
      .unique();
    if (!row) return null;
    if (row.status === "canceled" || row.status === "succeeded" || row.status === "failed") return null;
    await ctx.db.patch(row._id, { status: "cancelRequested" });
    if (row.workId && row.workpoolState !== "finished") {
      const pool = getPoolForName(row.workpoolName);
      if (pool) {
        await pool.cancel(ctx, row.workId as any);
      }
    }
    return null;
  },
});


export const listQueue = query({
  args: { workpoolName: v.string(), limit: v.optional(v.number()) },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;
    const items = await ctx.db
      .query("tasks")
      .withIndex("by_workpool_and_status", (q) => q.eq("workpoolName", args.workpoolName).eq("status", "pending"))
      .collect();
    // Sort pending by priority desc, runAt asc, createdAt asc
    items.sort((a: any, b: any) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      if (a.runAt !== b.runAt) return a.runAt - b.runAt;
      return a.createdAt - b.createdAt;
    });
    return items.slice(0, limit);
  },
});

export const listQueueByType = query({
  args: { workpoolName: v.string(), taskType: v.string(), limit: v.optional(v.number()) },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;
    const items = await ctx.db
      .query("tasks")
      .withIndex("by_workpool_type_and_status", (q) => q.eq("workpoolName", args.workpoolName).eq("taskType", args.taskType).eq("status", "pending"))
      .collect();
    items.sort((a: any, b: any) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      if (a.runAt !== b.runAt) return a.runAt - b.runAt;
      return a.createdAt - b.createdAt;
    });
    return items.slice(0, limit);
  },
});

export const listRunning = query({
  args: { workpoolName: v.string(), limit: v.optional(v.number()) },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;
    const items = await ctx.db
      .query("tasks")
      .withIndex("by_workpool_and_status", (q) => q.eq("workpoolName", args.workpoolName).eq("status", "running"))
      .collect();
    items.sort((a: any, b: any) => a.startedAt - b.startedAt);
    return items.slice(0, limit);
  },
});

export const listRunningByType = query({
  args: { workpoolName: v.string(), taskType: v.string(), limit: v.optional(v.number()) },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;
    const items = await ctx.db
      .query("tasks")
      .withIndex("by_workpool_type_and_status", (q) => q.eq("workpoolName", args.workpoolName).eq("taskType", args.taskType).eq("status", "running"))
      .collect();
    items.sort((a: any, b: any) => a.startedAt - b.startedAt);
    return items.slice(0, limit);
  },
});

export const listCompleted = query({
  args: { workpoolName: v.string(), limit: v.optional(v.number()) },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;
    const rows: any[] = [];
    for await (const it of ctx.db
      .query("tasks")
      .withIndex("by_workpool_and_status", (q) => q.eq("workpoolName", args.workpoolName).eq("status", "succeeded"))) {
      rows.push(it);
      if (rows.length >= limit) break;
    }
    rows.sort((a, b) => (b.finishedAt ?? b._creationTime) - (a.finishedAt ?? a._creationTime));
    return rows;
  },
});

export const listFailed = query({
  args: { workpoolName: v.string(), limit: v.optional(v.number()) },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;
    const rows: any[] = [];
    for await (const it of ctx.db
      .query("tasks")
      .withIndex("by_workpool_and_status", (q) => q.eq("workpoolName", args.workpoolName).eq("status", "failed"))) {
      rows.push(it);
      if (rows.length >= limit) break;
    }
    rows.sort((a, b) => (b.finishedAt ?? b._creationTime) - (a.finishedAt ?? a._creationTime));
    return rows;
  },
});

export const listCanceled = query({
  args: { workpoolName: v.string(), limit: v.optional(v.number()) },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;
    const rows: any[] = [];
    for await (const it of ctx.db
      .query("tasks")
      .withIndex("by_workpool_and_status", (q) => q.eq("workpoolName", args.workpoolName).eq("status", "canceled"))) {
      rows.push(it);
      if (rows.length >= limit) break;
    }
    rows.sort((a, b) => (b.finishedAt ?? b._creationTime) - (a.finishedAt ?? a._creationTime));
    return rows;
  },
});

export const listPaused = query({
  args: { workpoolName: v.string(), limit: v.optional(v.number()) },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;
    const rows: any[] = [];
    for await (const it of ctx.db
      .query("tasks")
      .withIndex("by_workpool_and_status", (q) => q.eq("workpoolName", args.workpoolName).eq("status", "paused"))) {
      rows.push(it);
      if (rows.length >= limit) break;
    }
    rows.sort((a, b) => (b._creationTime) - (a._creationTime));
    return rows;
  },
});

export const listTasksForEntity = query({
  args: { entityType: v.string(), entityId: v.string(), limit: v.optional(v.number()) },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;
    const rows: any[] = [];
    for await (const it of ctx.db.query("tasks").withIndex("by_runAt", (q) => q.gt("runAt", 0))) {
      const a = (it.args as any) ?? {};
      if (args.entityType === "candidate" && (a.candidateId === args.entityId)) rows.push(it);
      if (args.entityType === "job" && (a.jobId === args.entityId)) rows.push(it);
      if (rows.length >= limit) break;
    }
    rows.sort((a, b) => (b._creationTime) - (a._creationTime));
    return rows;
  },
});

export const pauseTask = mutation({
  args: { taskId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("tasks")
      .withIndex("by_taskId", (q) => q.eq("taskId", args.taskId))
      .unique();
    if (!row) return null;
    if (row.status !== "pending") return null;
    await ctx.db.patch(row._id, { status: "paused" });
    return null;
  },
});
export const getWorkpoolOverview = query({
  args: {},
  returns: v.object({
    import: v.object({ pending: v.number(), running: v.number(), finished: v.number(), failed: v.number(), canceled: v.number(), paused: v.number() }),
    build: v.object({ pending: v.number(), running: v.number(), finished: v.number(), failed: v.number(), canceled: v.number(), paused: v.number() }),
    embed: v.object({ pending: v.number(), running: v.number(), finished: v.number(), failed: v.number(), canceled: v.number(), paused: v.number() }),
    match: v.object({ pending: v.number(), running: v.number(), finished: v.number(), failed: v.number(), canceled: v.number(), paused: v.number() }),
  }),
  handler: async (ctx) => {
    const pools = ["import", "build", "embed", "match"] as const;
    const result: any = {};
    for (const p of pools) {
      let pending = 0, running = 0, finished = 0, failed = 0, canceled = 0, paused = 0;
      for await (const it of ctx.db
        .query("tasks")
        .withIndex("by_workpool_and_status", (q) => q.eq("workpoolName", p as string).eq("status", "pending"))) pending++;
      for await (const it of ctx.db
        .query("tasks")
        .withIndex("by_workpool_and_status", (q) => q.eq("workpoolName", p as string).eq("status", "running"))) running++;
      for await (const it of ctx.db
        .query("tasks")
        .withIndex("by_workpool_and_status", (q) => q.eq("workpoolName", p as string).eq("status", "succeeded"))) finished++;
      for await (const it of ctx.db
        .query("tasks")
        .withIndex("by_workpool_and_status", (q) => q.eq("workpoolName", p as string).eq("status", "failed"))) failed++;
      for await (const it of ctx.db
        .query("tasks")
        .withIndex("by_workpool_and_status", (q) => q.eq("workpoolName", p as string).eq("status", "canceled"))) canceled++;
      for await (const it of ctx.db
        .query("tasks")
        .withIndex("by_workpool_and_status", (q) => q.eq("workpoolName", p as string).eq("status", "paused"))) paused++;
      result[p] = { pending, running, finished, failed, canceled, paused };
    }
    return result;
  },
});

export const getItem = query({
  args: { taskId: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("tasks")
      .withIndex("by_taskId", (q) => q.eq("taskId", args.taskId))
      .unique();
  },
});

export const reorderItem = mutation({
  args: { taskId: v.string(), newPriority: v.number(), newRunAt: v.optional(v.number()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("tasks")
      .withIndex("by_taskId", (q) => q.eq("taskId", args.taskId))
      .unique();
    if (!row) return null;
    if (row.status !== "pending") return null; // safe path: only reorder pending
    const runAt = args.newRunAt ?? Date.now();
    // Update ordering fields
    await ctx.db.patch(row._id, { priority: args.newPriority, runAt });
    return null;
  },
});

// Centralized enqueue API validator (must be an object per Convex requirements)
const enqueueArgsValidator = v.object({
  taskType: v.union(
    v.literal("import"),
    v.literal("build_profile"),
    v.literal("cv_summarize"),
    v.literal("embed"),
    v.literal("match"),
  ),
  candidateId: v.optional(v.union(v.id("candidates"), v.string())),
  jobId: v.optional(v.union(v.id("jobs"), v.string())),
  resumeUrl: v.optional(v.string()),
  model: v.optional(v.string()),
  prompt: v.optional(v.string()),
  config: v.optional(v.any()),
  priority: v.optional(v.number()),
  runAt: v.optional(v.number()),
  requestedBy: v.optional(v.string()),
  argsSummary: v.optional(v.any()),
});

function getPoolForTaskType(taskType: string): Workpool {
  if (taskType === "import") return importPool;
  if (taskType === "build_profile") return buildPool;
  if (taskType === "cv_summarize") return buildPool;
  if (taskType === "embed") return embedPool;
  if (taskType === "match") return matchPool;
  return embedPool;
}

export const enqueueTask = mutation({
  args: enqueueArgsValidator,
  returns: v.object({ taskId: v.string(), workId: v.string() }),
  handler: async (ctx, args): Promise<{ taskId: string; workId: string }> => {
    // Build mapping
    const taskType: string = (args as any).taskType;
    if (taskType === "import") {
      const candidateId = (args as any).candidateId;
      const jobId = (args as any).jobId;
      if (!!candidateId === !!jobId) throw new Error("Provide either candidateId or jobId for import");
      const pool = getPoolForTaskType("import");
      if (candidateId) {
        const res = await enqueueTrackedAction(
          ctx,
          pool,
          internal.teamtailor.importCandidateToDb,
          { candidateId },
          {
            workpoolName: "import",
            taskType: "import",
            priority: (args as any).priority,
            runAt: (args as any).runAt,
            requestedBy: (args as any).requestedBy,
            argsSummary: (args as any).argsSummary ?? { candidateId },
          }
        );
        return res;
      } else {
        const res = await enqueueTrackedAction(
          ctx,
          pool,
          internal.teamtailor.importJobToDb,
          { jobId },
          {
            workpoolName: "import",
            taskType: "import",
            priority: (args as any).priority,
            runAt: (args as any).runAt,
            requestedBy: (args as any).requestedBy,
            argsSummary: (args as any).argsSummary ?? { jobId },
          }
        );
        return res;
      }
    }
    if (taskType === "build_profile") {
      const pool = getPoolForTaskType("build_profile");
      const candidateId = (args as any).candidateId;
      const jobId = (args as any).jobId;
      if (!!candidateId === !!jobId) throw new Error("Provide either candidateId or jobId for build_profile");
      if (candidateId) {
        const res = await enqueueTrackedAction(
          ctx,
          pool,
          internal.openaiAction.buildProfile,
          { candidateId },
          {
            workpoolName: "build",
            taskType: "build_profile",
            priority: (args as any).priority,
            runAt: (args as any).runAt,
            requestedBy: (args as any).requestedBy,
            argsSummary: (args as any).argsSummary ?? { candidateId },
          }
        );
        return res;
      } else {
        const res = await enqueueTrackedAction(
          ctx,
          pool,
          internal.openaiAction.buildJobProfile,
          { jobId },
          {
            workpoolName: "build",
            taskType: "build_profile",
            priority: (args as any).priority,
            runAt: (args as any).runAt,
            requestedBy: (args as any).requestedBy,
            argsSummary: (args as any).argsSummary ?? { jobId },
          }
        );
        return res;
      }
    }
    if (taskType === "cv_summarize") {
      const pool = getPoolForTaskType("cv_summarize");
      const candidateId = (args as any).candidateId;
      const resumeUrl = (args as any).resumeUrl;
      if (!candidateId) throw new Error("candidateId required for cv_summarize");
      const res = await enqueueTrackedAction(
        ctx,
        pool,
        internal.openaiAction.summarizeCv,
        { candidateId, resumeUrl },
        {
          workpoolName: "build",
          taskType: "cv_summarize",
          priority: (args as any).priority,
          runAt: (args as any).runAt,
          requestedBy: (args as any).requestedBy,
          argsSummary: (args as any).argsSummary ?? { candidateId, resumeUrl },
        }
      );
      return res;
    }
    if (taskType === "embed") {
      const pool = getPoolForTaskType("embed");
      const candidateId = (args as any).candidateId;
      const jobId = (args as any).jobId;
      if (!!candidateId === !!jobId) throw new Error("Provide either candidateId or jobId for embed");
      if (candidateId) {
        const res = await enqueueTrackedAction(
          ctx,
          pool,
          internal.openaiAction.buildCandidateEmbeddingsWrapper,
          { candidateId },
          {
            workpoolName: "embed",
            taskType: "embed",
            priority: (args as any).priority,
            runAt: (args as any).runAt,
            requestedBy: (args as any).requestedBy,
            argsSummary: (args as any).argsSummary ?? { candidateId },
          }
        );
        return res;
      } else {
        const res = await enqueueTrackedAction(
          ctx,
          pool,
          internal.openaiAction.buildJobEmbeddingsWrapper,
          { jobId },
          {
            workpoolName: "embed",
            taskType: "embed",
            priority: (args as any).priority,
            runAt: (args as any).runAt,
            requestedBy: (args as any).requestedBy,
            argsSummary: (args as any).argsSummary ?? { jobId },
          }
        );
        return res;
      }
    }
    if (taskType === "match") {
      const pool = getPoolForTaskType("match");
      const candidateId = (args as any).candidateId;
      const jobId = (args as any).jobId;
      const model = (args as any).model;
      const prompt = (args as any).prompt;
      const config = (args as any).config;
      if (!candidateId || !jobId) throw new Error("candidateId and jobId required for match");
      const res = await enqueueTrackedAction(
        ctx,
        pool,
        internal.openaiAction.matchCandidateToJob,
        { candidateId, jobId, model, prompt, config },
        {
          workpoolName: "match",
          taskType: "match",
          priority: (args as any).priority,
          runAt: (args as any).runAt,
          requestedBy: (args as any).requestedBy,
          argsSummary: (args as any).argsSummary ?? { candidateId, jobId, model, prompt, config },
        }
      );
      return res;
    }
    throw new Error("Unsupported taskType");
  },
});

export async function enqueueTrackedAction<ArgsT extends Record<string, unknown>>(
  ctx: any,
  pool: Workpool,
  fnRef: any,
  args: ArgsT,
  options: EnqueueTrackedOptions
): Promise<{ taskId: string; workId: string }> {
  const taskId = generateTrackingId();
  const now = Date.now();
  const runAt = options.runAt ?? now;
  const priority = options.priority ?? 0;

  const insertedId = await ctx.db.insert("tasks", {
    workpoolName: options.workpoolName,
    taskId,
    workId: undefined,
    taskKey: options.taskKey,
    taskType: options.taskType,
    fnHandle: "", // informational only; not strictly required
    fnName: "",
    fnType: "action",
    args: args as any,
    argsSummary: options.argsSummary,
    runAt,
    priority,
    status: "pending",
    workpoolState: "pending",
    previousAttempts: 0,
    progress: 0,
    progressMessage: undefined,
    lastHeartbeatAt: undefined,
    createdAt: now,
    startedAt: undefined,
    finishedAt: undefined,
    canceledAt: undefined,
    errorSummary: undefined,
    requestedBy: options.requestedBy,
  });

  const workId: string = await pool.enqueueAction(ctx, fnRef, { ...args, taskId }, {
    onComplete: internal.tasks.onComplete as any,
    context: { taskId },
    runAt,
  } as any);  

  await ctx.db.patch(insertedId, { workId });
  return { taskId, workId };
}

export async function enqueueTrackedMutation<ArgsT extends Record<string, unknown>>(
  ctx: any,
  pool: Workpool,
  fnRef: any,
  args: ArgsT,
  options: EnqueueTrackedOptions
): Promise<{ taskId: string; workId: string }> {
  const taskId = generateTrackingId();
  const now = Date.now();
  const runAt = options.runAt ?? now;
  const priority = options.priority ?? 0;

  const insertedId = await ctx.db.insert("tasks", {
    workpoolName: options.workpoolName,
    taskId,
    workId: undefined,
    taskKey: options.taskKey,
    taskType: options.taskType,
    fnHandle: "",
    fnName: "",
    fnType: "mutation",
    args: args as any,
    argsSummary: options.argsSummary,
    runAt,
    priority,
    status: "pending",
    workpoolState: "pending",
    previousAttempts: 0,
    progress: 0,
    progressMessage: undefined,
    lastHeartbeatAt: undefined,
    createdAt: now,
    startedAt: undefined,
    finishedAt: undefined,
    canceledAt: undefined,
    errorSummary: undefined,
    requestedBy: options.requestedBy,
  });

  const workId: string = await pool.enqueueMutation(ctx, fnRef, { ...args, taskId }, {
    onComplete: internal.tasks.onComplete as any,
    context: { taskId },
    runAt,
  } as any);

  await ctx.db.patch(insertedId, { workId });
  return { taskId, workId };
}


export const syncTasksStatus = internalMutation({
  args: { workpoolName: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Find non-final items (pending, running, cancelRequested)
    const pools = args.workpoolName ? [args.workpoolName] : ["import", "build", "embed", "match"];
    for (const poolName of pools) {
      const pool = getPoolForName(poolName);
      if (!pool) continue;

      const candidates: Array<any> = [];
      for await (const it of ctx.db
        .query("tasks")
        .withIndex("by_workpool_and_status", (q) => q.eq("workpoolName", poolName).eq("status", "pending"))) {
        if (it.workId) candidates.push(it);
      }
      for await (const it of ctx.db
        .query("tasks")
        .withIndex("by_workpool_and_status", (q) => q.eq("workpoolName", poolName).eq("status", "running"))) {
        if (it.workId) candidates.push(it);
      }
      for await (const it of ctx.db
        .query("tasks")
        .withIndex("by_workpool_and_status", (q) => q.eq("workpoolName", poolName).eq("status", "cancelRequested"))) {
        if (it.workId) candidates.push(it);
      }

      const ids: string[] = candidates.map((c) => c.workId as string);
      if (ids.length === 0) continue;
      const statuses = await pool.statusBatch(ctx, ids as any);
      for (let i = 0; i < candidates.length; i++) {
        const it = candidates[i];
        const st: any = (statuses as any)[i];
        let workpoolState: string | undefined;
        let previousAttempts: number | undefined;
        if (st?.state === "pending" || st?.state === "running" || st?.state === "finished") {
          workpoolState = st.state;
          previousAttempts = (st as any).previousAttempts;
        }
        await ctx.db.patch(it._id, { workpoolState, previousAttempts });
      }
    }
    return null;
  },
});
