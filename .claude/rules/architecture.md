# Project Architecture & Folder Structure

This document is the single source of truth for how the EduMark AI codebase is organised.
Claude Code must follow this structure and create new files in the correct places.

## High-Level Layers
- **app/**           — Next.js App Router routes (pages + API)
- **components/**    — Reusable UI components
- **hooks/**         — Client-side data fetching & state hooks (SWR)
- **lib/**           — Domain logic, integrations, and typed data access
- **supabase/**      — SQL migrations, seed data, and generated types
- **.claude/rules/** — Instruction files for Claude Code (this folder)

## Folder Tree

```txt
.
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── callback/page.tsx
│   ├── (dashboard)/
│   │   ├── dashboard/page.tsx
│   │   ├── pricing/page.tsx
│   │   ├── batches/page.tsx
│   │   ├── batches/[id]/page.tsx
│   │   └── settings/page.tsx
│   └── api/
│       ├── auth/
│       │   └── callback/route.ts
│       ├── tutor/
│       │   └── subscription/route.ts
│       ├── batches/
│       │   ├── route.ts          # create/list batches
│       │   └── [id]/
│       │       ├── route.ts      # get/update single batch
│       │       └── dispatch/route.ts  # trigger AI marking
│       ├── submissions/
│       │   └── upload/route.ts   # PDF upload endpoint
│       ├── reports/
│       │   └── [id]/download/route.ts # PDF report download
│       └── stripe/
│           ├── checkout/route.ts
│           ├── portal/route.ts
│           └── webhook/route.ts
│
├── components/
│   ├── layout/
│   │   ├── Shell.tsx
│   │   └── SidebarNav.tsx
│   ├── ui/                        # shadcn-style UI primitives
│   ├── batches/
│   │   ├── BatchList.tsx
│   │   ├── BatchDetail.tsx
│   │   └── BatchStatusBadge.tsx
│   ├── marking/
│   │   ├── MarkingSummary.tsx
│   │   └── QuestionFeedbackCard.tsx
│   ├── billing/
│   │   ├── AiMinutesBar.tsx
│   │   ├── PricingTable.tsx
│   │   └── UpgradeModal.tsx
│   └── shared/
│       ├── LanguageBadge.tsx
│       └── SubjectBadge.tsx
│
├── hooks/
│   ├── useTutorProfile.ts
│   ├── useBatches.ts
│   ├── useBatchDetail.ts
│   ├── useSubmissions.ts
│   ├── useMarkingResults.ts
│   ├── useBatchPolling.ts
│   └── useSubscription.ts
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts             # browser client
│   │   ├── server.ts             # server-side client (App Router)
│   │   └── service.ts            # service-role client (webhooks only)
│   ├── db/
│   │   ├── tutors.ts
│   │   ├── batches.ts
│   │   ├── submissions.ts
│   │   ├── marking-results.ts
│   │   └── marking-schemes.ts
│   ├── ai/
│   │   ├── claude-client.ts
│   │   ├── mark-paper.ts
│   │   ├── batch-dispatcher.ts
│   │   └── embeddings.ts
│   ├── stripe/
│   │   ├── client.ts
│   │   ├── plans.ts
│   │   └── subscription.ts
│   ├── billing/
│   │   └── gate.ts
│   ├── pdf/
│   │   ├── pdf-to-images.ts
│   │   ├── report-renderer.ts
│   │   └── fonts/
│   │       ├── NotoSansSinhala.ttf
│   │       └── NotoSansTamil.ttf
│   ├── fetcher.ts                 # generic SWR fetcher
│   ├── api-client.ts              # typed wrappers around /api routes
│   └── validations/
│       └── schemas.ts             # zod schemas for inputs
│
├── supabase/
│   ├── migrations/
│   │   └── 20260319_add_billing.sql
│   └── types/
│       └── database.types.ts
│
├── .claude/
│   └── rules/
│       ├── architecture.md
│       ├── database.md
│       ├── ai-integration.md
│       ├── data-fetching.md
│       ├── pdf-pipeline.md
│       ├── marking-workflow.md
│       ├── report-generation.md
│       ├── auth.md
│       ├── ui-conventions.md
│       ├── billing.md
│       ├── stripe-integration.md
│       └── feature-gating.md
│
├── CLAUDE.md
└── package.json
```

## Responsibilities by Area

- `app/(dashboard)`
  - Only layout, page composition, and calling hooks.
  - No raw `fetch` calls here; use SWR hooks exclusively.
- `app/api/*`
  - Thin HTTP layer.
  - Validate input, call `lib/db/*` and `lib/ai/*` functions, return JSON.
- `lib/db/*`
  - All database access.
  - One file per table / aggregate use-case.
- `lib/ai/*`
  - Claude and embeddings integration.
  - No Supabase client usage here; receive all IDs as arguments.
- `lib/stripe/*`
  - All Stripe API calls (Checkout, Portal, customers, subscriptions).
- `lib/billing/gate.ts`
  - Server-side billing checks and aggregation of tutor billing status.
- `hooks/*`
  - SWR hooks for client-side read-only data.
- `components/*`
  - Pure presentational + minor local state only.

Claude Code must keep new code consistent with this tree.
