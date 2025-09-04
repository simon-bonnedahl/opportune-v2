import { vWorkIdValidator, Workpool } from "@convex-dev/workpool";
import { components } from "./_generated/api";

export const importPool = new Workpool(components.importWorkpool, { maxParallelism: 2, retryActionsByDefault: true, logLevel: "INFO" });
export const buildPool = new Workpool(components.buildWorkpool, { maxParallelism: 5, retryActionsByDefault: true, logLevel: "INFO" });
export const embedPool = new Workpool(components.embedWorkpool, { maxParallelism: 5, retryActionsByDefault: true, logLevel: "INFO" });
export const matchPool = new Workpool(components.matchWorkpool, { maxParallelism: 10, retryActionsByDefault: true, logLevel: "INFO" });