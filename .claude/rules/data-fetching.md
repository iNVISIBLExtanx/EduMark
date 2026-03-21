# Data Fetching Pattern (SWR)

## Rule: ZERO data fetching in page.tsx files
Every `page.tsx` renders ONE top-level component. That component uses SWR hooks.

## SWR Config (app/layout.tsx)
```tsx
import { SWRConfig } from 'swr';
import { fetcher } from '@/lib/fetcher';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <SWRConfig value={{ fetcher, revalidateOnFocus: false, dedupingInterval: 5000 }}>
          {children}
        </SWRConfig>
      </body>
    </html>
  );
}
```

## Global Fetcher (lib/fetcher.ts)
```typescript
import { createBrowserClient } from '@/lib/supabase/client';

export const fetcher = async (url: string) => {
  const supabase = createBrowserClient();
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw Object.assign(new Error(err.message ?? 'API error'), { status: res.status });
  }
  return res.json();
};
```

## Hook Pattern
All hooks in `hooks/` follow this structure:

```typescript
// hooks/useBatches.ts
import useSWR from 'swr';

export function useBatches(subjectId?: string) {
  const key = subjectId ? `/api/batches?subject=${subjectId}` : '/api/batches';
  const { data, error, isLoading, mutate } = useSWR<Batch[]>(key);
  return { batches: data ?? [], error, isLoading, mutate };
}
```

## Mutation Pattern (POST/PATCH)
For writes, use a custom `apiFetch` utility (not SWR):
```typescript
// lib/api-client.ts
export async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const supabase = createBrowserClient();
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(url, {
    ...options,
    headers: { 
      Authorization: `Bearer ${session?.access_token ?? ''}`,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
```
After a mutation, call `mutate()` from the relevant SWR hook to revalidate.

## Polling Hook (for batch processing status)
```typescript
// hooks/useBatchPolling.ts
export function useBatchPolling(batchId: string, enabled: boolean) {
  const { data, error } = useSWR(
    enabled ? `/api/batches/${batchId}/results` : null,
    { refreshInterval: 15000 }   // poll every 15s while enabled
  );
  return { results: data, isDone: data?.status === 'completed', error };
}
```
Set `enabled = batch.status === 'processing'` — stops polling when done.

## Upload Helper (lib/api-client.ts)
For multipart form uploads (question papers, marking schemes), use `apiUpload` — same auth pattern as `apiFetch` but omits `Content-Type` header so the browser sets the multipart boundary:
```typescript
export async function apiUpload<T>(url: string, formData: FormData): Promise<T> { ... }
```

## Hooks List
| Hook | Key | Purpose |
|---|---|---|
| `useTutorProfile` | `/api/tutor/profile` | tutor info + marking_language |
| `useQuestionPapers` | `/api/question-papers` | tutor's question papers |
| `useTutorSubjects` | `/api/tutor/subjects` | tutor's registered subjects |
| `useBatches` | `/api/batches` | all batches for tutor |
| `useBatchDetail` | `/api/batches/[id]` | single batch with submissions |
| `useSubmissions` | `/api/batches/[id]/submissions` | submissions in a batch |
| `useMarkingResults` | `/api/submissions/[id]` | per-submission results |
| `useBatchPolling` | `/api/batches/[id]/results` | polls during processing |
