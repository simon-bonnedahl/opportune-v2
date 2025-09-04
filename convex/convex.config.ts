import { defineApp } from "convex/server";
import workpool from "@convex-dev/workpool/convex.config";
import presence from "@convex-dev/presence/convex.config";

const app = defineApp();
app.use(workpool, { name: "importWorkpool" });
app.use(workpool, { name: "buildWorkpool" });
app.use(workpool, { name: "embedWorkpool" });
app.use(workpool, { name: "matchWorkpool" });
app.use(presence)

export default app;