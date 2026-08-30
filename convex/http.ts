import { httpRouter } from "convex/server";
import { AgentMail } from "@agentmail/convex";
import { registerStaticRoutes } from "@convex-dev/static-hosting";
import { components, internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { auth } from "./auth";

const http = httpRouter();
const agentmail = new AgentMail(components.agentmail, {
  onMessageReceived: internal.confirmations.onMessageReceived,
  onEvent: internal.confirmations.onAgentMailEvent,
});

auth.addHttpRoutes(http);

http.route({
  path: "/webhooks/agentmail",
  method: "POST",
  handler: httpAction(async (ctx, request) =>
    agentmail.handleWebhook(
      ctx as unknown as Parameters<AgentMail["handleWebhook"]>[0],
      request,
    ),
  ),
});

registerStaticRoutes(http, components.staticHosting);

export default http;
