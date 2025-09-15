import { vWorkIdValidator, Workpool, WorkpoolComponent, WorkpoolOptions } from "@convex-dev/workpool";
import {
    customCtx,
    customMutation,
    customQuery,
    customAction
  } from "convex-helpers/server/customFunctions";
import { components, internal } from "./_generated/api";
import { action, ActionCtx, MutationCtx, query } from "./_generated/server";
import { TaskType } from "./types";
import { FunctionReference } from "convex/server";



class TaskWorkPool extends Workpool {
    name: string;
    allowedTasks: { type: TaskType; ref: FunctionReference<"action", "internal", any>; }[];
    constructor(component: WorkpoolComponent, name: string, options: WorkpoolOptions, allowedTasks: { type: TaskType; ref: FunctionReference<"action", "internal", any>; }[]) {
        super(component, options);
        this.name = name;
        this.allowedTasks = allowedTasks;
    }
}

export const importPool: TaskWorkPool = new TaskWorkPool(
    components.importWorkpool,
    "import",
    { maxParallelism: 1, retryActionsByDefault: false, logLevel: "INFO" },
    [
        {
            type: "import",
            ref: internal.tasks.task_tt_import,
        }
    ]
);

export const buildPool: TaskWorkPool = new TaskWorkPool(
    components.buildWorkpool,
    "build",
    { maxParallelism: 5, retryActionsByDefault: false, logLevel: "INFO" },
    [
        {
            type: "build_profile",
            ref: internal.tasks.task_build_profile,
        },
    ]
);

export const embedPool: TaskWorkPool = new TaskWorkPool(
    components.embedWorkpool,
    "embed",
    { maxParallelism: 1, retryActionsByDefault: false, logLevel: "INFO" },
    [
        {
            type: "embed_profile",
            ref: internal.tasks.task_embed_profile,
        }
    ]
);

export const matchPool: TaskWorkPool = new TaskWorkPool(
    components.matchWorkpool,
    "match",
    { maxParallelism: 5, retryActionsByDefault: false, logLevel: "INFO" },
    [
        {
            type: "match",
            ref: internal.tasks.task_match,
        }
    ]
);

export const pools: TaskWorkPool[] = [
    importPool,
    buildPool,
    embedPool,
    matchPool,
];


export const getWorkpoolForTaskType = (taskType: TaskType) => {
    return pools.find(pool => pool.allowedTasks.some(task => task.type === taskType));
}




