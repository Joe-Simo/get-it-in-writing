import { defineApp } from "convex/server";
import { v } from "convex/values";
import agentmailComponent from "@agentmail/convex/convex.config";
import firecrawlComponent from "@firecrawl/firecrawl-convex/convex.config";
import staticHosting from "@convex-dev/static-hosting/convex.config";

const app = defineApp({
  env: {
    AGENTMAIL_API_KEY: v.string(),
    AGENTMAIL_BASE_URL: v.optional(v.string()),
    FIRECRAWL_API_KEY: v.string(),
    FIRECRAWL_WEBHOOK_SECRET: v.optional(v.string()),
  },
});
app.use(agentmailComponent, {
  env: {
    AGENTMAIL_API_KEY: app.env.AGENTMAIL_API_KEY,
    AGENTMAIL_BASE_URL: app.env.AGENTMAIL_BASE_URL,
  },
});
app.use(firecrawlComponent, {
  httpPrefix: "/firecrawl/",
  env: {
    FIRECRAWL_API_KEY: app.env.FIRECRAWL_API_KEY,
    FIRECRAWL_WEBHOOK_SECRET: app.env.FIRECRAWL_WEBHOOK_SECRET,
  },
});
app.use(staticHosting);

export default app;
