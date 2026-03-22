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
