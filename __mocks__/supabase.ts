import { vi } from 'vitest';

export const mockSupabaseClient = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  upsert: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  rpc: vi.fn(),
  auth: {
    getUser: vi.fn(),
    getSession: vi.fn(),
    signInWithOAuth: vi.fn(),
    exchangeCodeForSession: vi.fn(),
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

vi.mock('@/lib/supabase/client', () => ({
  createBrowserClient: () => mockSupabaseClient,
}));

vi.mock('@/lib/supabase/service', () => ({
  createServiceRoleClient: () => mockSupabaseClient,
}));
