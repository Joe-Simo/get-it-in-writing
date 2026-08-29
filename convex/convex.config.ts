import { defineApp } from "convex/server";
import staticHosting from "@convex-dev/static-hosting/convex.config";
import workflow from "@convex-dev/workflow/convex.config";

// Keep existing app HTTP routes at their current root URLs.
const app = defineApp();
app.use(staticHosting);
app.use(workflow);

export default app;
