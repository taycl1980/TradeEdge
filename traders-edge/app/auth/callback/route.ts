import { createClient } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';

// Handles the redirect back from Supabase auth (magic link / OAuth),
// exchanges the code for a session, then sends the user to the app.
export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
