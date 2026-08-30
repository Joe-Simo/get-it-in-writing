# Signal Garden

Signal Garden turns a consequential question and trusted URLs into a bounded,
source-linked decision brief a team can inspect, challenge, and review by
email. It is a production application built for the Convex All Gas Hackathon,
not a staged showcase.

[Open Signal Garden](https://resilient-salamander-937.convex.site) ·
[Inspect the live federal renovation bid decision](https://resilient-salamander-937.convex.site/garden/what-must-a-small-construction-firm--52a65131)

## Why it exists

Agentic research becomes difficult to trust when scope, citations, and human
decisions disappear behind a generated brief. Signal Garden keeps the research
boundary and the handoff to people visible:

- Firecrawl missions declare page and depth budgets before collection.
- OpenAI structured outputs attach extracted claims to source passages.
- Convex streams mission state, evidence, notes, reviews, and public gardens.
- AgentMail replies become verified review items; email alone cannot expand a
  crawl budget or spend credits.
- vgpu renders the evidence field with validated WebGPU shaders and an
  accessible static mode.

The featured public decision is real production output. Firecrawl processed
three official federal and safety sources, OpenAI structured 28 linked claims,
Convex produced and published the brief, and AgentMail delivered it to the
existing team member. The public projection excludes identities, email
addresses, message contents, private notes, and webhook records server-side.

## Product flow

1. Create a team and frame a question with trusted starting URLs.
2. Review the page, depth, and domain limits before launching the workflow.
3. Follow the live Convex timeline while Firecrawl collects bounded evidence.
4. Inspect source-linked claims and add private team notes.
5. Send a brief through AgentMail and review verified replies in the app.
6. Publish or revoke a read-only decision page for collaborators or judges.

## Stack

- React, TypeScript, Vite, Tailwind CSS, and shadcn/ui
- Convex Auth, realtime database, actions, HTTP actions, scheduled functions,
  Workflow, and Static Hosting
- OpenAI Responses API using `gpt-5.6-luna` for extraction and
  `gpt-5.6-terra` for synthesis
- Firecrawl
- AgentMail with Svix webhook verification
- vgpu and WGSL

## Run locally

Install dependencies with Bun:

```bash
bun install
```

Connect a new Convex deployment for your own environment, then provide the
required server-side variables through Convex rather than client files:

```text
OPENAI_API_KEY
FIRECRAWL_API_KEY
FIRECRAWL_WEBHOOK_SECRET
AGENTMAIL_API_KEY
AGENTMAIL_INBOX_ID
AGENTMAIL_WEBHOOK_SECRET
SITE_URL
PUBLIC_APP_URL
```

Start the app and Convex development workflow:

```bash
bun run dev:full
```

## Quality checks

```bash
bun run lint
bun run test
bun run check:gpu
bun run build
```

The evidence-based hackathon build record is maintained in
[hackathon.md](./hackathon.md).
