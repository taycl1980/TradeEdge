import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Creates a Stripe Customer Portal session for the logged-in user and
// returns the hosted URL. The portal handles cancel, pause, payment
// method updates, and invoice downloads — we never build any of that
// ourselves. This is the supported, audited path.
//
// Requires the user to already have a stripe_customer_id (set by the
// checkout webhook). Free-tier users without a customer ID hit a 400.
export async function POST() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single();

  if (!profile?.stripe_customer_id) {
    return NextResponse.json(
      { error: 'no_customer', message: 'No Stripe customer on file. Upgrade to Pro first.' },
      { status: 400 }
    );
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL!;
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${siteUrl}/dashboard/settings`,
    });
    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    // The most common failure here is that the portal hasn't been
    // configured in the Stripe dashboard yet. Surface the real error
    // so the operator knows what to fix.
    return NextResponse.json(
      { error: 'portal_failed', message: err?.message || 'Could not open billing portal' },
      { status: 500 }
    );
  }
}
