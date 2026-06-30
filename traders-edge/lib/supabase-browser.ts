import { createBrowserClient } from '@supabase/ssr';

// Browser-side Supabase client. Uses only the public anon key,
// which is safe to expose. Row Level Security protects the data.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
