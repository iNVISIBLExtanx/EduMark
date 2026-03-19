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

### Browser (SWR hooks, client components)
```typescript
// lib/supabase/client.ts
import { createBrowserClient as _create } from '@supabase/ssr';
export const createBrowserClient = () =>
  _create(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
```

## Auth Guard
Protected routes are under `app/(dashboard)/`. The layout checks session server-side and redirects to `/login` if unauthenticated.

## API Route Auth Pattern
Every API route must verify the JWT:
```typescript
const supabase = createServerClient();
const { data: { user }, error } = await supabase.auth.getUser();
if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
```
RLS on the database enforces ownership — the server client uses the user's JWT, so Supabase automatically filters rows by `auth.uid()`.

## OAuth Callback
`app/api/auth/callback/route.ts` handles the Google OAuth code exchange using `supabase.auth.exchangeCodeForSession(code)`.
