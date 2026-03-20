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
