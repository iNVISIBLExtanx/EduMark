import { createBrowserClient } from '@/lib/supabase/client';

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
  if (!res.ok) {
    const text = await res.text();
    let message = text;
    try { message = JSON.parse(text).error ?? text; } catch { /* use raw text */ }
    throw new Error(message);
  }
  return res.json();
}

export async function apiUpload<T>(url: string, formData: FormData): Promise<T> {
  const supabase = createBrowserClient();
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session?.access_token ?? ''}`,
    },
    body: formData,
  });
  if (!res.ok) {
    const text = await res.text();
    let message = text;
    try { message = JSON.parse(text).error ?? text; } catch { /* use raw text */ }
    throw new Error(message);
  }
  return res.json();
}
