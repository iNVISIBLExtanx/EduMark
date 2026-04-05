# Project Architecture & Folder Structure

This document is the single source of truth for how the EduMark AI codebase is organised.
Claude Code must follow this structure and create new files in the correct places.

## High-Level Layers
- **app/**           — Next.js App Router routes (pages + API)
- **components/**    — Reusable UI components
- **hooks/**         — Client-side data fetching & state hooks (SWR)
- **lib/**           — Domain logic, integrations, and typed data access
- **supabase/**      — SQL migrations, seed data, and generated types
- **__mocks__/**     — Shared test mocks (Supabase, Stripe, Anthropic)
- **.claude/rules/** — Instruction files for Claude Code (this folder)

## Testing
- Tests live in `__tests__/` at the project root, mirroring the source tree: `lib/billing/gate.ts` → `__tests__/lib/billing/gate.test.ts`
- Cross-cutting/E2E tests go directly in `__tests__/` root: `__tests__/e2e-marking-flow.test.ts`
- Shared mocks in `__mocks__/` (supabase, stripe, anthropic)
- See `.claude/rules/testing.md` for full testing strategy

## Folder Tree

```txt
.
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   ├── callback/page.tsx
│   │   └── onboarding/page.tsx
│   ├── (dashboard)/
│   │   ├── dashboard/page.tsx
│   │   ├── pricing/page.tsx
│   │   ├── papers/
│   │   │   ├── page.tsx              # question papers dashboard
│   │   │   └── QuestionPapersView.tsx
│   │   ├── batches/page.tsx
│   │   ├── batches/[id]/page.tsx
│   │   └── settings/page.tsx
│   └── api/
│       ├── auth/
│       │   └── callback/route.ts
│       ├── tutor/
│       │   ├── profile/route.ts      # GET/POST tutor profile + registration
│       │   ├── subjects/route.ts     # GET tutor's registered subjects
│       │   └── subscription/route.ts
│       ├── batches/
│       │   ├── route.ts          # create/list batches
│       │   └── [id]/
│       │       ├── route.ts      # get/update single batch
│       │       ├── submissions/route.ts  # GET submissions for batch
│       │       ├── dispatch/route.ts  # POST trigger AI marking
│       │       ├── poll/route.ts      # GET poll Claude Batch API results
│       │       └── results/route.ts   # GET all marking results for batch
│       ├── question-papers/
│       │   ├── route.ts          # GET/POST question papers
│       │   └── [id]/
│       │       └── route.ts      # DELETE question paper + scheme
│       ├── marking-schemes/
│       │   └── route.ts          # POST marking schemes
│       ├── subjects/
│       │   └── route.ts          # list all subjects
│       ├── submissions/
│       │   ├── upload/route.ts   # bulk PDF upload endpoint
│       │   └── [id]/
│       │       ├── route.ts          # GET { results, summary } for a submission
│       │       └── override/route.ts  # PATCH tutor mark overrides
│       ├── reports/
│       │   └── [id]/
│       │       ├── download/route.ts # PDF report download
│       │       └── approve/route.ts  # POST tutor approves report
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
│   │   ├── BatchStatusBadge.tsx
│   │   ├── BulkUploader.tsx
│   │   ├── CreateBatchDialog.tsx
│   │   └── SubmissionResultsPanel.tsx
│   ├── marking/
│   │   ├── MarkingSummary.tsx
│   │   └── QuestionFeedbackCard.tsx
│   ├── papers/
│   │   ├── QuestionPaperUploadForm.tsx
│   │   └── QuestionPaperList.tsx
│   ├── billing/
│   │   ├── AiMinutesBar.tsx
│   │   ├── PastDueBanner.tsx
│   │   ├── PlanBadge.tsx
│   │   ├── PricingTable.tsx
│   │   └── UpgradeModal.tsx
│   ├── dashboard/
│   │   └── DashboardHome.tsx
│   ├── settings/
│   │   └── SettingsView.tsx
│   ├── marketing/
│   │   ├── TestimonialsAndTrust.tsx   # dark section: language scripts, trust signals, CTA (server component)
│   │   ├── LanguageShowcase.tsx       # tab switcher: Sinhala/Tamil/English feedback demo ('use client')
│   │   └── SubjectSpotlight.tsx       # Combined Maths structure card + coming-soon subjects (server component)
│   └── shared/
│       ├── LanguageBadge.tsx
│       └── SubjectBadge.tsx
│
├── hooks/
│   ├── useTutorProfile.ts
│   ├── useBatches.ts
│   ├── useBatchDetail.ts
│   ├── useQuestionPapers.ts
│   ├── useTutorSubjects.ts
│   ├── useSubmissions.ts
│   ├── useMarkingResults.ts
│   ├── useBatchPolling.ts
│   ├── useSubscription.ts
│   └── useAllSubjects.ts
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts             # browser client
│   │   ├── server.ts             # server-side client (App Router)
│   │   └── service.ts            # service-role client (webhooks only)
│   ├── db/
│   │   ├── tutors.ts             # tutor profile + getTutorSubjects
│   │   ├── question-papers.ts    # question paper CRUD
│   │   ├── batches.ts
│   │   ├── billing.ts
│   │   ├── submissions.ts
│   │   ├── marking-results.ts
│   │   ├── marking-schemes.ts
│   │   └── reports.ts            # report CRUD (get, create/update, approve)
│   ├── ai/
│   │   ├── claude-client.ts
│   │   ├── mark-paper.ts
│   │   ├── batch-dispatcher.ts
│   │   ├── embeddings.ts
│   │   ├── chunking.ts           # marking scheme text chunking for embeddings
│   │   └── openai-client.ts      # OpenAI SDK singleton (lazy-init proxy)
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
│   │       ├── NotoSansTamil.ttf
│   │       ├── noto-sans-sinhala.ts   # Base64 Sinhala font constant
│   │       └── noto-sans-tamil.ts     # Base64 Tamil font constant
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
├── __tests__/                 # All test files, mirrors source tree structure
│   ├── lib/
│   │   ├── stripe/
│   │   ├── billing/
│   │   ├── db/
│   │   ├── ai/
│   │   └── pdf/
│   ├── app/api/
│   ├── hooks/
│   ├── components/
│   └── e2e-marking-flow.test.ts  # cross-cutting E2E tests
│
├── __mocks__/                 # Shared test mocks (Supabase, Stripe, Anthropic, OpenAI)
│   ├── supabase.ts
│   ├── stripe.ts
│   ├── anthropic.ts
│   └── openai.ts
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
- `components/marketing/*`
  - Public landing page sections. All static data — no SWR hooks, no API calls.
  - Server components by default; use `'use client'` only when tabs/interactivity needed (e.g. `LanguageShowcase`).
  - Never mention specific AI model names (Claude, Anthropic, Sonnet). Use "advanced AI" / "state-of-the-art AI".
  - No emojis. Sri Lankan identity through copy ("Sri Lanka's A/L"), font classes, and color palette.

Claude Code must keep new code consistent with this tree.
