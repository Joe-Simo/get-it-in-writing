# Get It in Writing

**Don’t rely on “probably.”**

Get It in Writing protects everyday consumer decisions. Paste the official page
you are about to rely on and state the exact thing that must be true. The app
separates what the source establishes from vague or missing language, then helps
you get only the consequential gap confirmed in writing.

[Open the production app](https://resilient-salamander-937.convex.site)

## The product

1. Start a private case with an official page and every requirement that would
   change the decision.
2. Review a source-backed Reliance Map. Each scoped requirement is classified
   as established, conditional, conflicting, a scope mismatch, or not
   established.
3. If a material gap remains, review the verified official recipient and one
   exact message that asks only about the unresolved requirements.
4. Explicitly approve the request before it is sent.
5. When a real reply arrives, keep each answer, its exact conditions, the
   original source evidence, and its scope in a private Proof Card.
6. Keep the card honest when an official source changes: the previous and new
   passages remain visible until the owner acknowledges the change.

The first release is intended for ordinary bookings, rentals, purchases, and
services. It is not for medical, legal, financial, insurance, employment, or
safety guarantees. It never guesses contact addresses and never sends without
the owner’s approval.

## System boundaries

- Convex owns authenticated private cases, the realtime state machine, source
  records, confirmation status, replies, and Proof Cards.
- Firecrawl performs bounded research on the submitted official domain.
- OpenAI produces structured assessments that are checked against the captured
  source text before supportive claims are stored.
- AgentMail sends the owner-approved message. Convex correlates real replies by
  provider thread and a unique request token, deduplicates them, and interprets
  them requirement by requirement. The production deployment checks the single
  configured inbox every minute; the authenticated webhook route can be enabled
  when the AgentMail key has webhook-administration permission.
- Convex Static Hosting serves the production frontend at `convex.site`.

All provider credentials stay in server-side Convex environment variables.
No secret belongs in a client environment variable, source file, build log, or
browser bundle.

## Local development

Install dependencies and connect this checkout to its own Convex deployment:

```bash
bun install
bun run dev:full
```

Required server-side deployment environment names:

```text
OPENAI_API_KEY
FIRECRAWL_API_KEY
AGENTMAIL_API_KEY
AGENTMAIL_INBOX_ID
SITE_URL
PUBLIC_APP_URL
```

`AGENTMAIL_WEBHOOK_SECRET` is optional. When an AgentMail webhook is registered,
its write-only custom `Authorization` header must use this value. The application
does not require webhook administration to receive replies because its Convex
cron performs retry-safe, idempotent inbox ingestion.

## Verification

```bash
bun run lint
bun run test
bun run test:e2e
bun run build
```

The hackathon build record is maintained in
[hackathon.md](./hackathon.md).
