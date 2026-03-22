# Authentication & Authorization

## Provider
Supabase Auth with:
- Email + Password
- Google OAuth

## Registration Flow
Tutor registers → selects `marking_language` (Sinhala / Tamil / English) → selects subjects from the 6 available → record created in `tutors` table + `tutor_subjects` join table.

`marking_language` is permanent (not per-batch). It is used in EVERY marking API call. Never ask for it per-batch.

## Supabase Clients

### Server (API routes, Server Components)
```typescript
// lib/supabase/server.ts
import { createServerClient as _create } from '@supabase/ssr';
import { cookies } from 'next/headers';

export function createServerClient() {
  return _create(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookies().getAll(), setAll: (c) => c.forEach(({ name, value, options }) => cookies().set(name, value, options)) } }
  );
}
```

### Browser (SWR hooks, client components) — SINGLETON
```typescript
// lib/supabase/client.ts
import { createBrowserClient as _create } from '@supabase/ssr';

let client: ReturnType<typeof _create> | null = null;

export const createBrowserClient = () => {
  if (!client) {
    client = _create(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return client;
};
```

**Why singleton**: The browser client is used by the SWR fetcher, `apiFetch`, and `apiUpload`. Without a singleton, each call creates a new instance and `getSession()` re-parses cookies independently. With a singleton, `getSession()` returns the in-memory cached session instantly. This is critical for tab switch performance — a page with 4 SWR hooks would otherwise make 4 independent session lookups.

## Auth Guard
Protected routes are under `app/(dashboard)/`. The layout checks session server-side and redirects to `/login` if unauthenticated.

### Layout Auth with `React.cache()`
The dashboard layout wraps the auth + tutor lookup in `React.cache()` to deduplicate within a single render pass:
```typescript
import { cache } from 'react';

const getAuthenticatedTutor = cache(async () => {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const tutor = await getTutorByIdOrNull(user.id);
  return { user, tutor };
});
```
This prevents redundant `getUser()` + DB calls when multiple server components in the same request need the authenticated tutor.

## API Route Auth Pattern
Every API route must verify the JWT:
```typescript
const supabase = createServerClient();
const { data: { user }, error } = await supabase.auth.getUser();
if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
```
RLS on the database enforces ownership — the server client uses the user's JWT, so Supabase automatically filters rows by `auth.uid()`.

## Logout
The logout button is in `components/layout/SidebarNav.tsx`. On click:
1. Confirmation dialog opens (shadcn `Dialog` with destructive "Log out" button)
2. On confirm: `createBrowserClient().auth.signOut()` — clears the Supabase session
3. `router.push('/login')` — redirects to the login page

## Profile Update
Tutors can edit their full name, marking language, and subjects via the Settings page.
- `PATCH /api/tutor/profile` — validates with `updateProfileSchema`, calls `updateTutorProfile` + `replaceTutorSubjects`
- RLS grants `UPDATE (full_name, marking_language)` to authenticated users
- Subject replacement: deletes existing `tutor_subjects` rows then inserts new ones

## OAuth Callback
`app/api/auth/callback/route.ts` handles the Google OAuth code exchange using `supabase.auth.exchangeCodeForSession(code)`.
