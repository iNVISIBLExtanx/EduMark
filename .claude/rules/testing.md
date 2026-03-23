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
When using `vi.clearAllMocks()` in `beforeEach`, it resets `mockReturnThis()` implementations.
You MUST re-establish the mock chain after clearing:
```typescript
beforeEach(() => {
  vi.clearAllMocks();
  // Re-establish mock chain after clearAllMocks resets implementations
  mockSupabaseClient.from.mockReturnThis();
  mockSupabaseClient.select.mockReturnThis();
  mockSupabaseClient.eq.mockReturnThis();
  mockSupabaseClient.update.mockReturnThis();
});
```

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

## Current Test Coverage (636 tests, 52 files)
| File | Tests | Coverage area |
|------|-------|---------------|
| `__tests__/lib/stripe/subscription.test.ts` | 7 | Customer creation, DB persist, error handling |
| `__tests__/lib/stripe/plans.test.ts` | 8 | Plan constants, prices, ordering |
| `__tests__/lib/billing/gate.test.ts` | 12 | isActive, hasMinutes, getBillingStatus |
| `__tests__/lib/db/billing.test.ts` | 8 | checkAndDeductMinutes, RPC error, all statuses |
| `__tests__/lib/db/question-papers.test.ts` | 8 | Question paper CRUD, tutor scoping |
| `__tests__/lib/db/marking-schemes.test.ts` | 18 | Create, fetch, update structure, chunking integration |
| `__tests__/lib/db/submissions.test.ts` | 11 | createStudentAndSubmission, updateBatchPaperCount, getSubmissionById |
| `__tests__/lib/db/batches.test.ts` | 8 | createBatch, updateBatchStatus, getBatchById |
| `__tests__/lib/db/marking-results.test.ts` | 10 | getMarkingResultsBySubmission, getMarkingResultsByBatch, saveMarkingResults, updateMarkingOverride |
| `__tests__/lib/pdf/pdf-to-images.test.ts` | 17 | PDF conversion, page count, warnings, scale |
| `__tests__/lib/ai/chunking.test.ts` | 14 | Marking scheme chunking, text splitting |
| `__tests__/lib/ai/embeddings.test.ts` | 18 | OpenAI embeddings, pgvector storage, retrieval |
| `__tests__/lib/ai/mark-paper.test.ts` | 12 | Prompt construction, response parsing, language |
| `__tests__/lib/ai/batch-dispatcher.test.ts` | 26 | Dispatch: billing-first, Batch API shape, cache_control. Poll: result parsing, status updates, partial failures |
| `__tests__/app/api/stripe/webhook/route.test.ts` | 19 | All 5 webhook events, edge cases, security |
| `__tests__/app/api/stripe/checkout/route.test.ts` | 10 | Auth, validation, checkout params |
| `__tests__/app/api/stripe/portal/route.test.ts` | 6 | Auth, customer lookup, portal session |
| `__tests__/app/api/tutor/subscription/route.test.ts` | 6 | Auth, query shape, response |
| `__tests__/app/api/question-papers/route.test.ts` | 10 | Auth, file validation, subject check, upload |
| `__tests__/app/api/marking-schemes/route.test.ts` | 6 | Auth, file validation, paper ownership |
| `__tests__/app/api/marking-schemes/[id]/embeddings/route.test.ts` | 11 | Auth, chunking, embedding generation, error handling |
| `__tests__/app/api/batches/route.test.ts` | 8 | Auth, validation, paper/scheme ownership |
| `__tests__/app/api/batches/[id]/submissions/route.test.ts` | 6 | Auth, ownership, submissions listing, error handling |
| `__tests__/app/api/batches/[id]/dispatch/route.test.ts` | 13 | Auth, billing gate (402), batch ownership, insufficient minutes, dispatch success/errors, double-dispatch prevention |
| `__tests__/app/api/batches/[id]/poll/route.test.ts` | 8 | Auth, processing/completed/failed status, batch_not_dispatched |
| `__tests__/app/api/batches/[id]/results/route.test.ts` | 8 | Auth, batch ownership, results listing, empty batch |
| `__tests__/app/api/submissions/upload/route.test.ts` | 10 | Auth, metadata, batch status, bulk upload |
| `__tests__/app/api/submissions/[id]/override/route.test.ts` | 8 | Auth, Zod validation (400), success 200, DB error handling |
| `__tests__/app/api/tutor/profile/route.test.ts` | 12 | GET/POST/PATCH auth, validation, success, errors |
| `__tests__/hooks/useSubscription.test.ts` | 10 | All derived values, edge cases |
| `__tests__/hooks/useBatchPolling.test.ts` | 5 | Corrected poll URL, enabled/disabled toggle, refreshInterval |
| `__tests__/components/billing/AiMinutesBar.test.tsx` | 6 | All visual states |
| `__tests__/components/billing/PricingTable.test.tsx` | 9 | Plans display, checkout, top-up |
| `__tests__/components/billing/PastDueBanner.test.tsx` | 6 | Loading, visibility, portal redirect |
| `__tests__/components/billing/UpgradeModal.test.tsx` | 5 | Open/close, links, overlay |
| `__tests__/components/billing/PlanBadge.test.tsx` | 10 | Badge rendering per plan |
| `__tests__/components/papers/QuestionPaperUploadForm.test.tsx` | 7 | Form render, validation, upload flow |
| `__tests__/components/dashboard/DashboardHome.test.tsx` | 20 | Greeting, batches, UpgradeModal, loading/error, quick stats, upgrade threshold |
| `__tests__/components/settings/SettingsView.test.tsx` | 17 | Profile card, billing card, edit mode, save/cancel, portal |
| `__tests__/components/batches/BatchStatusBadge.test.tsx` | 7 | All status styles, fallback, base classes |
| `__tests__/components/batches/BatchList.test.tsx` | 7 | Loading/error/empty states, links, counts, badges |
| `__tests__/components/batches/BatchDetail.test.tsx` | 31 | Loading/error/null states, heading, badges, submissions table, View Results toggle, results panel, download/approve buttons, dispatch button, polling, BulkUploader integration |
| `__tests__/components/batches/BulkUploader.test.tsx` | 25 | Drop zone, file validation, upload, drag-and-drop |
| `__tests__/components/batches/SubmissionResultsPanel.test.tsx` | 8 | Loading, error, results display, MarkingSummary + QuestionFeedbackCard rendering |
| `__tests__/components/marking/QuestionFeedbackCard.test.tsx` | 13 | Read-only render, edit toggle, save/cancel flow, override display, language fonts, OCR badge, saving state |
| `__tests__/components/marking/MarkingSummary.test.tsx` | 4 | Basic render, percentage, override totals, adjustment note |
| `__tests__/components/layout/SidebarNav.test.tsx` | 7 | Nav items, logout confirmation dialog, active state |
| `__tests__/lib/db/reports.test.ts` | 10 | Reports CRUD: get, upsert, approve, null handling |
| `__tests__/lib/pdf/report-renderer.test.ts` | 15 | HTML builder, font embedding, overrides, Puppeteer PDF |
| `__tests__/app/api/reports/[id]/download/route.test.ts` | 12 | Auth, ownership, approval gate, PDF generation, storage upload |
| `__tests__/app/api/reports/[id]/approve/route.test.ts` | 8 | Auth, ownership, status check, approval success |
| `__tests__/e2e-marking-flow.test.ts` | 77 | Full tutor workflow (Phase 1–12): upload, batch, submissions, dispatch to Claude, poll processing, poll completed with result storage, batch results retrieval, tutor mark overrides, report approval, PDF report download, Phase 11 dashboard, Phase 12 edge cases (double-dispatch, mixed results, file limits) |
