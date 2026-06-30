import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Server-side Supabase client (server components + route handlers).
// Reads the user session from cookies so we can identify the
// authenticated user securely on the server.
export function createClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The setAll method can fail in Server Components that are
            // read-only. Middleware refreshes the session, so this is safe.
          }
        },
      },
    }
  );
}

// Admin client using the SERVICE ROLE key — bypasses Row Level Security.
// Use ONLY in trusted server contexts (e.g. the Stripe webhook) to update
// a user's plan. Never import this into client code.
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
