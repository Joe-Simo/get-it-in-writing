# Signal Garden

Signal Garden is an always-on mystery shopper for the customer journeys a
business cannot afford to lose. It checks a real public path—such as a contact
or quote form—then follows the confirmation and reply handoffs that happen
after the click. When a customer-facing step breaks or a promised response is
late, the team gets an evidence-backed incident instead of discovering the
problem from a lost lead.

[Open Signal Garden](https://resilient-salamander-937.convex.site) ·
[Inspect the latest real run](https://resilient-salamander-937.convex.site/proof/setup-request-to-confirmation-cd8df1tc)

## Why it exists

Uptime monitoring can prove that a page returned `200 OK`. It cannot prove that
a customer completed the form, saw a success state, received an acknowledgement,
or got the follow-up the business promised. Signal Garden monitors that whole
customer outcome.

The product is useful to any business whose revenue or service depends on a
public digital handoff: agencies, home-service companies, clinics, property
managers, professional services, local businesses, and SaaS teams.

## How a journey works

1. The owner enters the business website.
2. Firecrawl maps the public site and OpenAI proposes safe, testable journeys.
3. The owner reviews the exact path and explicitly authorizes form testing.
4. A clearly identified QA customer completes the approved public request once.
5. AgentMail observes the correlated confirmation and any expected human reply.
6. Convex streams every checkpoint, opens incidents, schedules repeat runs, and
   produces a customer-safe public proof page.

Signal Garden never enters payment, login, government ID, health, financial,
or other sensitive data; bypasses a captcha; uploads files; books scarce time;
or submits without owner authorization. Provider failures are recorded as
execution errors, not misrepresented as customer incidents.

## Real production evidence

The featured proof page comes from a real owner-authorized run against Signal
Garden's own production setup journey. Firecrawl reached the live
`convex.site`, completed its public request form, and observed the visible
success state. AgentMail recorded the correlated confirmation addressed to the
QA customer. Convex joined those signals into one healthy run. The public
projection excludes customer identities, inbox addresses, form contents,
private notes, provider identifiers, and secrets.

## Stack

- React, TypeScript, Vite, Tailwind CSS, and shadcn/ui
- Convex Auth, realtime database, actions, HTTP actions, crons, scheduled
  functions, Workflow, and Static Hosting
- OpenAI structured outputs for safe journey discovery and evidence evaluation
- Firecrawl scrape and Interact for real public journey execution
- AgentMail sending, webhooks, and mailbox reconciliation
- vgpu and WGSL for the live visual field

## Run locally

Install dependencies with Bun:

```bash
bun install
```

Connect a new Convex deployment for your own environment. Keep every secret in
Convex server-side environment variables, never in client files:

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

Start the frontend and Convex development workflow:

```bash
bun run dev:full
```

## Quality checks

```bash
bun run lint
bun run test
bun run test:e2e
bun run check:gpu
bun run build
```

The evidence-based hackathon build record is maintained in
[hackathon.md](./hackathon.md).
