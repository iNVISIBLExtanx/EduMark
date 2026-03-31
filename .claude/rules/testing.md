# Testing Strategy

## Framework
- **Vitest** for all unit and integration tests
- **@testing-library/react** for component tests
- **MSW (Mock Service Worker)** for API mocking in integration tests

## Commands
```bash
pnpm test           # run all tests
pnpm test:watch     # watch mode during development
pnpm test:coverage  # run with coverage report
pnpm test:ui        # Vitest UI
```

## File Conventions
- Test files live in the `__tests__/` directory at the project root, **mirroring the source tree structure**
- Example: `lib/billing/gate.ts` → `__tests__/lib/billing/gate.test.ts`
- Example: `hooks/useSubscription.ts` → `__tests__/hooks/useSubscription.test.ts`
- Example: `app/api/stripe/webhook/route.ts` → `__tests__/app/api/stripe/webhook/route.test.ts`
- Example: `components/billing/AiMinutesBar.tsx` → `__tests__/components/billing/AiMinutesBar.test.tsx`
- Cross-cutting and E2E tests go directly in `__tests__/` root: `__tests__/e2e-marking-flow.test.ts`
- Shared mocks remain in `__mocks__/` at the project root (not inside `__tests__/`)

## What to Test

### MUST test (every feature needs these)
1. **`lib/db/*` query functions** — mock Supabase client, verify correct queries and error handling
2. **`lib/billing/gate.ts`** — all billing states (active, past_due, canceled, insufficient minutes)
3. **`lib/ai/*`** — prompt construction, response parsing, error cases (mock Anthropic SDK)
4. **`lib/stripe/*`** — customer creation, plan mapping, price validation
5. **`app/api/*` route handlers** — request validation, auth checks, correct status codes, response shape
6. **`hooks/*`** — SWR hooks return correct data, handle loading/error states
7. **`components/*`** — render correct UI for each state, user interactions fire correct callbacks

### Test categories
| Category | What | Mock strategy |
|----------|------|---------------|
| Unit | `lib/` functions | Mock Supabase/Stripe/Anthropic SDK calls |
| Integration | API routes | Mock DB + external APIs, test full request→response |
| Component | React components | Mock SWR hooks, test render output + interactions |
| Hook | SWR hooks | Mock fetch/fetcher, test data transformation |

## Mocking Patterns

### Supabase Client Mock
```typescript
// __mocks__/supabase.ts
import { vi } from 'vitest';

export const mockSupabaseClient = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  rpc: vi.fn(),
  auth: {
    getUser: vi.fn(),
    getSession: vi.fn(),
  },
  storage: {
    from: vi.fn().mockReturnValue({
      upload: vi.fn(),
      createSignedUrl: vi.fn(),
    }),
  },
};

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: () => mockSupabaseClient,
}));
```

### Stripe Mock
```typescript
// __mocks__/stripe.ts
import { vi } from 'vitest';

export const mockStripe = {
  customers: { create: vi.fn(), retrieve: vi.fn() },
  checkout: { sessions: { create: vi.fn() } },
  subscriptions: { retrieve: vi.fn() },
  billingPortal: { sessions: { create: vi.fn() } },
  webhooks: { constructEvent: vi.fn() },
};

vi.mock('@/lib/stripe/client', () => ({ stripe: mockStripe }));
```

### Anthropic Mock
```typescript
// __mocks__/anthropic.ts
import { vi } from 'vitest';

export const mockAnthropic = {
  messages: { create: vi.fn() },
  beta: {
    messages: {
      batches: {
        create: vi.fn(),
        retrieve: vi.fn(),
        results: vi.fn(),
      },
    },
  },
};

vi.mock('@/lib/ai/claude-client', () => ({ anthropic: mockAnthropic }));
```

## Vitest Config (vitest.config.ts)
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['__tests__/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        '.next/',
        'supabase/',
        '.claude/',
        '**/*.d.ts',
        'vitest.config.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
```

## Setup File (vitest.setup.ts)
```typescript
import '@testing-library/jest-dom/vitest';
```

## Mock Chain Reset Pattern
When a test file has multiple `describe` blocks that queue `mockResolvedValueOnce` / `mockReturnValueOnce` values, use `vi.resetAllMocks()` instead of `vi.clearAllMocks()` in `beforeEach`. `clearAllMocks` clears call history but does NOT flush queued one-time implementations — leftover queued values from earlier tests bleed into later ones.

```typescript
beforeEach(() => {
  vi.resetAllMocks();  // clears call history AND flushes queued one-time implementations
  // Re-establish default mock chain after reset
  mockSupabaseClient.from.mockReturnThis();
  mockSupabaseClient.select.mockReturnThis();
  mockSupabaseClient.eq.mockReturnThis();
  mockSupabaseClient.order.mockReturnThis();
  mockSupabaseClient.update.mockReturnThis();
  mockSupabaseClient.insert.mockReturnThis();
});
```

Use `vi.clearAllMocks()` only in tests that do NOT rely on `mockReturnValueOnce`/`mockResolvedValueOnce` ordering across multiple `describe` blocks.

When a mock method is called multiple times in a single flow (e.g. `.eq()` used for both SELECT and UPDATE chains), use `mockReturnValueOnce` / `mockResolvedValueOnce` to handle each call separately.

## Rules
- Every new feature MUST include tests before it is considered complete
- Tests must cover: happy path, error/edge cases, and auth checks (for API routes)
- API route tests must verify 401 for unauthenticated requests
- Billing-related tests must cover all plan states and edge cases
- Never test implementation details — test behavior and outputs
- Use `describe` blocks to group related tests, `it` for individual cases
- Keep tests focused: one assertion concept per `it` block
- **When a test fails, investigate the source code first.** If the function has a real bug, fix the source code — do NOT patch the test to pass. The purpose of tests is to verify correctness, not to rubber-stamp existing behavior.
- Use `stripe trigger` for real API testing after unit tests pass — some bugs (e.g. null fields on real Stripe events) are only discoverable with real API calls, not mocks

## Current Test Coverage (787 tests, 57 files)
| File | Tests | Coverage area |
|------|-------|---------------|
| `__tests__/lib/stripe/subscription.test.ts` | 7 | Customer creation, DB persist, error handling |
| `__tests__/lib/stripe/plans.test.ts` | 8 | Plan constants, prices, ordering |
| `__tests__/lib/billing/gate.test.ts` | 12 | isActive, hasMinutes, getBillingStatus |
| `__tests__/lib/db/billing.test.ts` | 8 | checkAndDeductMinutes, RPC error, all statuses |
| `__tests__/lib/db/question-papers.test.ts` | 13 | Question paper CRUD, tutor scoping, getBatchCountByPaper, deleteQuestionPaper |
| `__tests__/lib/db/marking-schemes.test.ts` | 18 | Create, fetch, update structure, chunking integration |
| `__tests__/lib/db/submissions.test.ts` | 11 | createStudentAndSubmission, updateBatchPaperCount, getSubmissionById |
| `__tests__/lib/db/batches.test.ts` | 10 | createBatch, updateBatchStatus, getBatchById, updateBatchName |
| `__tests__/lib/db/marking-results.test.ts` | 16 | getMarkingResultsByBatch (part/sub_questions columns, ordering), saveMarkingResults (part, sub_questions insert; submissions summary update; ocr sanitization), updateMarkingOverride |
| `__tests__/lib/pdf/pdf-to-images.test.ts` | 5 | getPdfPageCount: page count, lightweight check, error handling |
| `__tests__/lib/ai/chunking.test.ts` | 14 | Marking scheme chunking, text splitting |
| `__tests__/lib/ai/embeddings.test.ts` | 18 | OpenAI embeddings, pgvector storage, retrieval |
| `__tests__/lib/ai/mark-paper.test.ts` | 26 | buildSystemPrompt (subject configs, BEST-5/7, Part A/B XML, language rules, paper_name, fallbacks, no /10 in selection_rule, rules 13+14+15+16+17 present, paperName filters to only matching paper, without paperName includes all papers), buildUserMessageText (7 steps, paper label, no full transcription in step 2, best-N instruction), markingResultSchema (paper_name, part, sub_questions, best_questions_selected, student_answer_text optional), markingOutputFormat |
| `__tests__/lib/ai/batch-dispatcher.test.ts` | 34 | Dispatch: billing-first, Batch API shape, cache_control, buildSystemPrompt called with paperName, sanitizeMarkingResult (wrong max_marks corrected, BEST-5 recomputed, totals recomputed, non-CM unchanged, part inferred fallback), subject extracted from Supabase single-object FK join (not array). Poll: result parsing, status updates, partial failures, subject extracted from single-object question_papers.subjects join |
| `__tests__/app/api/stripe/webhook/route.test.ts` | 19 | All 5 webhook events, edge cases, security |
| `__tests__/app/api/stripe/checkout/route.test.ts` | 10 | Auth, validation, checkout params |
| `__tests__/app/api/stripe/portal/route.test.ts` | 6 | Auth, customer lookup, portal session |
| `__tests__/app/api/tutor/subscription/route.test.ts` | 6 | Auth, query shape, response |
| `__tests__/app/api/question-papers/route.test.ts` | 10 | Auth, file validation, subject check, upload |
| `__tests__/app/api/question-papers/[id]/route.test.ts` | 7 | Auth, ownership (404), batch guard (409), successful delete, storage cleanup, missing scheme |
| `__tests__/app/api/marking-schemes/route.test.ts` | 6 | Auth, file validation, paper ownership |
| `__tests__/app/api/marking-schemes/[id]/embeddings/route.test.ts` | 11 | Auth, chunking, embedding generation, error handling |
| `__tests__/app/api/batches/route.test.ts` | 8 | Auth, validation, paper/scheme ownership |
| `__tests__/app/api/batches/[id]/submissions/route.test.ts` | 6 | Auth, ownership, submissions listing, error handling |
| `__tests__/app/api/batches/[id]/dispatch/route.test.ts` | 15 | Auth, billing gate (402), batch ownership, insufficient minutes, dispatch success/errors, double-dispatch prevention, paper_name stored when provided, updateBatchPaperName not called when absent |
| `__tests__/app/api/batches/[id]/poll/route.test.ts` | 8 | Auth, processing/completed/failed status, batch_not_dispatched |
| `__tests__/app/api/batches/[id]/results/route.test.ts` | 8 | Auth, batch ownership, results listing, empty batch |
| `__tests__/app/api/submissions/upload/route.test.ts` | 10 | Auth, metadata, batch status, bulk upload |
| `__tests__/app/api/submissions/[id]/override/route.test.ts` | 8 | Auth, Zod validation (400), success 200, DB error handling |
| `__tests__/app/api/tutor/profile/route.test.ts` | 12 | GET/POST/PATCH auth, validation, success, errors |
| `__tests__/hooks/useSubscription.test.ts` | 10 | All derived values, edge cases |
| `__tests__/hooks/useBatchDetail.test.ts` | 8 | Batch fields, paper_name exposed, subject_name extracted from nested join |
| `__tests__/hooks/useBatchPolling.test.ts` | 5 | Corrected poll URL, enabled/disabled toggle, refreshInterval |
| `__tests__/components/billing/AiMinutesBar.test.tsx` | 6 | All visual states |
| `__tests__/components/billing/PricingTable.test.tsx` | 9 | Plans display, checkout, top-up |
| `__tests__/components/billing/PastDueBanner.test.tsx` | 6 | Loading, visibility, portal redirect |
| `__tests__/components/billing/UpgradeModal.test.tsx` | 5 | Open/close, links, overlay |
| `__tests__/components/billing/PlanBadge.test.tsx` | 10 | Badge rendering per plan |
| `__tests__/components/papers/QuestionPaperUploadForm.test.tsx` | 7 | Form render, validation, upload flow |
| `__tests__/components/papers/QuestionPaperList.test.tsx` | 8 | Table render, delete button, confirm dialog, API call, error states |
| `__tests__/components/batches/CreateBatchDialog.test.tsx` | 10 | Form fields, paper dropdown, medium default, validation, submit, error, cancel |
| `__tests__/components/dashboard/DashboardHome.test.tsx` | 20 | Greeting, batches, UpgradeModal, loading/error, quick stats, upgrade threshold |
| `__tests__/components/settings/SettingsView.test.tsx` | 17 | Profile card, billing card, edit mode, save/cancel, portal |
| `__tests__/components/batches/BatchStatusBadge.test.tsx` | 7 | All status styles, fallback, base classes |
| `__tests__/components/batches/BatchList.test.tsx` | 13 | Loading/error/empty states, links, counts, badges, Create Batch button + dialog, delete batch from card |
| `__tests__/components/batches/BatchDetail.test.tsx` | 44 | Loading/error/null states, heading, badges, submissions table, View Results opens dialog, dialog shows student name, dialog closes on onClose, download/approve buttons, dispatch button, polling, BulkUploader integration, back button, edit batch name, Combined Maths paper selector (shows/hides/non-CM, disables dispatch until selection, enables after selection, sends paper_name in body) |
| `__tests__/components/batches/BulkUploader.test.tsx` | 25 | Drop zone, file validation, upload, drag-and-drop |
| `__tests__/components/batches/SubmissionResultsPanel.test.tsx` | 8 | Loading, error, results display, MarkingSummary + QuestionFeedbackCard rendering |
| `__tests__/components/batches/SubmissionReviewDialog.test.tsx` | 7 | Renders when isOpen=true, hidden when isOpen=false, shows student name in title, renders SubmissionResultsPanel with correct submissionId, Close calls onClose, Approve & Download triggers approve→download fetch, Download Report triggers download fetch |
| `__tests__/components/marking/QuestionFeedbackCard.test.tsx` | 18 | Read-only render, part badge (Part A/B/null), sub-question breakdown, edit toggle, save/cancel flow, override display, language fonts, OCR badge, saving state |
| `__tests__/components/marking/MarkingSummary.test.tsx` | 4 | Basic render, percentage, override totals, adjustment note |
| `__tests__/components/layout/SidebarNav.test.tsx` | 7 | Nav items, logout confirmation dialog, active state |
| `__tests__/lib/db/reports.test.ts` | 10 | Reports CRUD: get, upsert, approve, null handling |
| `__tests__/lib/pdf/report-renderer.test.ts` | 24 | HTML builder, font embedding, overrides, Puppeteer PDF, paperName in header, Part A/B grouping, sub-questions table, best-5/not-counted badges, general_feedback block, totalAwarded/totalMax from params, fallback totals |
| `__tests__/app/api/reports/[id]/download/route.test.ts` | 15 | Auth, ownership, approval gate, PDF generation, storage upload, new fields (part, sub_questions, paperName, generalFeedback, bestQuestionsSelected, totalAwarded, totalMax) passed to buildReportHTML |
| `__tests__/app/api/reports/[id]/approve/route.test.ts` | 8 | Auth, ownership, status check, approval success |
| `__tests__/e2e-marking-flow.test.ts` | 77 | Full tutor workflow (Phase 1–12): upload, batch, submissions, dispatch to Claude, poll processing, poll completed with result storage (paper_name + part fields), batch results retrieval, tutor mark overrides, report approval, PDF report download, Phase 11 dashboard, Phase 12 edge cases (double-dispatch, mixed results, file limits) |
