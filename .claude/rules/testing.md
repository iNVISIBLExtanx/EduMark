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

## Rules
- Every new feature MUST include tests before it is considered complete
- Tests must cover: happy path, error/edge cases, and auth checks (for API routes)
- API route tests must verify 401 for unauthenticated requests
- Billing-related tests must cover all plan states and edge cases
- Never test implementation details — test behavior and outputs
- Use `describe` blocks to group related tests, `it` for individual cases
- Keep tests focused: one assertion concept per `it` block
