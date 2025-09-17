import { defineApp } from "convex/server";
import workpool from "@convex-dev/workpool/convex.config";
import presence from "@convex-dev/presence/convex.config";
import crons from "@convex-dev/crons/convex.config";

const app = defineApp();
app.use(workpool, { name: "importWorkpool" });
app.use(workpool, { name: "buildWorkpool" });
app.use(workpool, { name: "embedWorkpool" });
app.use(workpool, { name: "matchWorkpool" });
app.use(presence)
app.use(crons)
export default app;