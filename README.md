# Signal Garden

Signal Garden tests a business's lead form every day and emails the owner when
it breaks. Each authorized check opens the real public page, submits one clearly
labeled test lead, verifies the success state and expected confirmation, and
shows exactly which step failed.

[Open Signal Garden](https://resilient-salamander-937.convex.site) ·
[Inspect the latest real check](https://resilient-salamander-937.convex.site/proof/setup-request-to-confirmation-cd8df1tc)

## Why it exists

Uptime monitoring can prove that a page returned `200 OK`. It cannot prove that
a visitor can submit the form or receive the expected acknowledgement. These
failures are often silent, so a business discovers them only after leads have
already been lost.

Signal Garden is for home-service companies, agencies, consultants, B2B sales
teams, and other businesses whose next customer starts with a website form.

## How a check works

1. The owner enters the business website.
2. Signal Garden finds the strongest public contact, quote, or demo form.
3. The owner reviews the exact form and explicitly authorizes testing.
4. A clearly identified QA submission completes the approved public form once.
5. Signal Garden verifies the page result and expected confirmation email.
6. If a customer-facing step fails, the owner receives a plain-language email
   with a direct link to the check details and rerun control.

The private beta monitors one website and one approved lead form once per day.
Signal Garden never enters payment, login, government ID, health, financial,
or other sensitive data; bypasses a captcha; uploads files; books scarce time;
or submits without owner authorization. A test-alert control lets the owner
verify email delivery without creating a fake website failure.

If a captcha, sensitive field, or ambiguous action makes the form unsafe to
submit, Signal Garden pauses monitoring and asks the owner to review it. A
safety stop is never reported as a broken customer experience.

## Real production check

The featured proof page comes from a real owner-authorized check against Signal
Garden's own production setup form. Firecrawl reached the live
`convex.site`, completed its public request form, and observed the visible
success state. AgentMail recorded the correlated confirmation addressed to the
QA customer. Convex joined those signals into one healthy check. The production
owner test-alert action also delivered through AgentMail and recorded a sent
delivery on its first attempt. The public
projection excludes customer identities, inbox addresses, form contents,
private notes, provider identifiers, and secrets.

## Implementation

- React, TypeScript, Vite, Tailwind CSS, and shadcn/ui
- Convex Auth, realtime database, actions, HTTP actions, crons, scheduled
  functions, and Static Hosting
- OpenAI structured outputs for safe form discovery and result evaluation
- Firecrawl scrape and Interact for real public form execution
- AgentMail confirmation monitoring, owner alerts, webhooks, and mailbox reconciliation

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
bun run build
```

The hackathon build record is maintained in
[hackathon.md](./hackathon.md).
