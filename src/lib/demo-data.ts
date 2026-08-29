import type { EvidenceEdge, EvidenceNode } from "./graph-types";

export const demoQuestion =
  "How can agentic research systems make synthesized briefs trustworthy enough for small teams to act on?";

export const demoNodes: EvidenceNode[] = [
  {
    id: "convex-source",
    label: "Convex workflows",
    detail: "Durable workflows resume multi-step work and record completed steps.",
    kind: "source",
    status: "supported",
    confidence: 0.98,
    x: -0.7,
    y: -0.22,
    url: "https://docs.convex.dev/agents/workflows",
  },
  {
    id: "firecrawl-source",
    label: "Firecrawl Crawl API",
    detail: "Crawls expose explicit page limits, discovery depth, and external-link controls.",
    kind: "source",
    status: "supported",
    confidence: 0.98,
    x: -0.36,
    y: 0.58,
    url: "https://docs.firecrawl.dev/api-reference/endpoint/crawl-post",
  },
  {
    id: "openai-source",
    label: "OpenAI Responses API",
    detail: "Structured outputs constrain model responses to a supplied JSON schema.",
    kind: "source",
    status: "supported",
    confidence: 0.97,
    x: 0.32,
    y: 0.62,
    url: "https://developers.openai.com/api/reference/resources/responses",
  },
  {
    id: "agentmail-source",
    label: "AgentMail webhooks",
    detail: "Svix signatures authenticate inbound email webhook payloads before processing.",
    kind: "source",
    status: "supported",
    confidence: 0.99,
    x: 0.72,
    y: -0.18,
    url: "https://docs.agentmail.to/webhook-verification",
  },
  {
    id: "bounded-claim",
    label: "Bound every research mission",
    detail: "Visible crawl budgets make scope and spend understandable before work begins.",
    kind: "claim",
    status: "supported",
    confidence: 0.91,
    x: -0.2,
    y: 0.15,
  },
  {
    id: "provenance-claim",
    label: "Keep claims attached to passages",
    detail: "A brief is inspectable when every conclusion resolves to exact source evidence.",
    kind: "claim",
    status: "supported",
    confidence: 0.94,
    x: 0.16,
    y: -0.08,
  },
  {
    id: "human-claim",
    label: "Human review remains a control surface",
    detail: "Email requests that can spend credits or expand scope wait for in-app approval.",
    kind: "claim",
    status: "unresolved",
    confidence: 0.82,
    x: 0.2,
    y: -0.5,
  },
];

export const demoEdges: EvidenceEdge[] = [
  { id: "e1", source: "firecrawl-source", target: "bounded-claim", support: "supports" },
  { id: "e2", source: "openai-source", target: "provenance-claim", support: "supports" },
  { id: "e3", source: "convex-source", target: "provenance-claim", support: "context" },
  { id: "e4", source: "agentmail-source", target: "human-claim", support: "supports" },
  { id: "e5", source: "bounded-claim", target: "provenance-claim", support: "context" },
  { id: "e6", source: "provenance-claim", target: "human-claim", support: "context" },
];

export const demoEvents = [
  { time: "00:04", label: "4 official domains admitted", type: "crawl" },
  { time: "00:09", label: "24-page budget enforced", type: "mission" },
  { time: "00:18", label: "7 evidence objects linked", type: "claim" },
  { time: "00:31", label: "Brief ready for review", type: "brief" },
];
