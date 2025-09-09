import { vWorkIdValidator, Workpool } from "@convex-dev/workpool";
import { components } from "./_generated/api";

export const importPool = new Workpool(components.importWorkpool, { maxParallelism: 2, retryActionsByDefault: false, logLevel: "INFO" });
export const buildPool = new Workpool(components.buildWorkpool, { maxParallelism: 5, retryActionsByDefault: false, logLevel: "INFO" });
export const embedPool = new Workpool(components.embedWorkpool, { maxParallelism: 5, retryActionsByDefault: false, logLevel: "INFO" });
export const matchPool = new Workpool(components.matchWorkpool, { maxParallelism: 10, retryActionsByDefault: false, logLevel: "INFO" });