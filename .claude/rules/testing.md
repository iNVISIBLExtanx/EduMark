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
- Test files live **next to** the file they test, named `*.test.ts` or `*.test.tsx`
- Example: `lib/billing/gate.ts` → `lib/billing/gate.test.ts`
- Example: `hooks/useSubscription.ts` → `hooks/useSubscription.test.ts`
- Example: `app/api/stripe/webhook/route.ts` → `app/api/stripe/webhook/route.test.ts`

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
    include: ['**/*.test.{ts,tsx}'],
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

## Current Test Coverage (274 tests, 29 files)
| File | Tests | Coverage area |
|------|-------|---------------|
| `lib/stripe/subscription.test.ts` | 7 | Customer creation, DB persist, error handling |
| `lib/stripe/plans.test.ts` | 8 | Plan constants, prices, ordering |
| `lib/billing/gate.test.ts` | 12 | isActive, hasMinutes, getBillingStatus |
| `lib/db/billing.test.ts` | 8 | checkAndDeductMinutes, RPC error, all statuses |
| `lib/db/question-papers.test.ts` | 8 | Question paper CRUD, tutor scoping |
| `lib/db/marking-schemes.test.ts` | 8 | Create, fetch, update structure |
| `lib/db/submissions.test.ts` | 8 | createStudentAndSubmission, updateBatchPaperCount |
| `lib/db/batches.test.ts` | 8 | createBatch, updateBatchStatus, getBatchById |
| `lib/pdf/pdf-to-images.test.ts` | 17 | PDF conversion, page count, warnings, scale |
| `app/api/stripe/webhook/route.test.ts` | 19 | All 5 webhook events, edge cases, security |
| `app/api/stripe/checkout/route.test.ts` | 10 | Auth, validation, checkout params |
| `app/api/stripe/portal/route.test.ts` | 6 | Auth, customer lookup, portal session |
| `app/api/tutor/subscription/route.test.ts` | 6 | Auth, query shape, response |
| `app/api/question-papers/route.test.ts` | 10 | Auth, file validation, subject check, upload |
| `app/api/marking-schemes/route.test.ts` | 6 | Auth, file validation, paper ownership |
| `app/api/batches/route.test.ts` | 8 | Auth, validation, paper/scheme ownership |
| `app/api/submissions/upload/route.test.ts` | 10 | Auth, metadata, batch status, bulk upload |
| `hooks/useSubscription.test.ts` | 10 | All derived values, edge cases |
| `components/billing/AiMinutesBar.test.tsx` | 6 | All visual states |
| `components/billing/PricingTable.test.tsx` | 9 | Plans display, checkout, top-up |
| `components/billing/PastDueBanner.test.tsx` | 6 | Loading, visibility, portal redirect |
| `components/billing/UpgradeModal.test.tsx` | 5 | Open/close, links, overlay |
| `components/billing/PlanBadge.test.tsx` | 10 | Badge rendering per plan |
| `components/papers/QuestionPaperUploadForm.test.tsx` | 7 | Form render, validation, upload flow |
| `components/dashboard/DashboardHome.test.tsx` | 13 | Greeting, batches, UpgradeModal, loading/error |
| `components/settings/SettingsView.test.tsx` | 17 | Profile card, billing card, edit mode, save/cancel, portal |
| `components/layout/SidebarNav.test.tsx` | 7 | Nav items, logout confirmation dialog, active state |
| `app/api/tutor/profile/route.test.ts` | 12 | GET/POST/PATCH auth, validation, success, errors |
