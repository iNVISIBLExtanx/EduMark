import { createClient } from '@supabase/supabase-js';

// ONLY use this in server-side webhook handlers and trusted background jobs.
// NEVER import in client components, SWR hooks, or regular API routes.
export const createServiceRoleClient = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! // NO NEXT_PUBLIC_ prefix
  );
