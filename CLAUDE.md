# EduMark AI — Sri Lanka A/L Paper Marking Platform

## What This Is
AI-powered essay marking SaaS for Sri Lankan A/L tutors. Tutors upload handwritten student papers (PDF), Claude marks them against a tutor-uploaded marking scheme, and generates per-question reports with feedback in the tutor's registered language (Sinhala / Tamil / English).

## Core Tech Stack
- **Framework**: Next.js 15 (App Router) + TypeScript -- strict mode on
- **Database / Auth / Storage**: Supabase (PostgreSQL + pgvector + Storage + Auth)
- **AI Marking Engine**: Claude Sonnet 4.6 API (vision multimodal, Batch API, Prompt Caching)
- **Embeddings / RAG**: OpenAI `text-embedding-3-small` stored in Supabase pgvector
- **PDF Reports**: Puppeteer (server-side, Vercel serverless via `@sparticuz/chromium`)
- **Data Fetching (client)**: SWR -- all client data fetching goes through `hooks/` -- NEVER fetch inside `page.tsx`
- **Auth**: Supabase Auth + Google OAuth
- **Billing**: Stripe -- monthly LKR subscriptions, payouts to foreign bank account

## Key Conventions (always apply)
- No data fetching in `page.tsx` -- use SWR hooks from `hooks/` only
- All API routes live in `app/api/` -- one file per resource
- Supabase client: use `createServerClient` in server components/routes, `createBrowserClient` in hooks
- Use `createServiceRoleClient` ONLY in the Stripe webhook handler and trusted background jobs -- never in regular API routes or client code
- Every Claude API call must use Prompt Caching on the marking scheme system block
- Language (sinhala | tamil | english) comes from `tutor.marking_language` -- set at registration, never per-batch
- All DB queries go through `lib/db/` typed query functions -- no raw SQL in routes
- Feature gating (AI minutes, plan checks) reads FRESH from DB server-side -- NEVER from JWT claims
- Stripe env vars and SUPABASE_SERVICE_ROLE_KEY must NEVER have NEXT_PUBLIC_ prefix

## Rules Index
When starting a task, read the relevant rule file first:

| Task area                               | Rule file                               |
|-----------------------------------------|-----------------------------------------|
| Database schema & queries               | `.claude/rules/database.md`             |
| Folder structure & module map           | `.claude/rules/architecture.md`         |
| Claude AI integration & caching         | `.claude/rules/ai-integration.md`       |
| SWR hooks pattern                       | `.claude/rules/data-fetching.md`        |
| PDF upload & processing pipeline        | `.claude/rules/pdf-pipeline.md`         |
| Marking workflow & batch jobs           | `.claude/rules/marking-workflow.md`     |
| PDF report generation                   | `.claude/rules/report-generation.md`    |
| Auth & RLS                              | `.claude/rules/auth.md`                 |
| UI components & styling                 | `.claude/rules/ui-conventions.md`       |
| Stripe billing & AI minutes model       | `.claude/rules/billing.md`              |
| Stripe API integration & webhook setup  | `.claude/rules/stripe-integration.md`   |
| Feature gating & access control         | `.claude/rules/feature-gating.md`       |

## Build & Dev Commands
```bash
pnpm dev          # local dev (Next.js + Supabase local)
pnpm build        # production build
pnpm lint         # ESLint
pnpm type-check   # tsc --noEmit
supabase start    # start local Supabase stack
supabase db push  # apply migrations
stripe listen --forward-to localhost:3000/api/stripe/webhook  # local webhook testing
```

## Environment Variables
See `.env.example`. All variables listed below are REQUIRED.

### Public (safe for browser)
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_APP_URL=https://edumark.lk
```

### Server-only (NEVER add NEXT_PUBLIC_ prefix to these)
```
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_STARTER=
STRIPE_PRICE_STANDARD=
STRIPE_PRICE_PRO=
STRIPE_PRICE_INSTITUTE=
STRIPE_PRICE_TOPUP=
```
