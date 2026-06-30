import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Creates a Stripe Checkout session for the logged-in user and returns
// the hosted checkout URL. The secret key never leaves the server.
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { plan } = await req.json(); // 'monthly' | 'annual'
  const priceId =
    plan === 'annual'
      ? process.env.NEXT_PUBLIC_STRIPE_PRICE_ANNUAL!
      : process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY!;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL!;

  // Reuse an existing Stripe customer if we have one, else let Checkout
  // create it. We pass the Supabase user id so the webhook can match.
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single();

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    customer: profile?.stripe_customer_id || undefined,
    customer_email: profile?.stripe_customer_id ? undefined : user.email,
    client_reference_id: user.id,
    metadata: { supabase_user_id: user.id },
    success_url: `${siteUrl}/dashboard?upgraded=1`,
    cancel_url: `${siteUrl}/dashboard?canceled=1`,
  });

  return NextResponse.json({ url: session.url });
}
