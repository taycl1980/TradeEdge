import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createAdminClient } from '@/lib/supabase-server';
import { sendEmail } from '@/lib/email/send';
import { cancellationEmail } from '@/lib/email/templates';

export const runtime = 'nodejs';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Stripe calls this endpoint on subscription lifecycle events. We:
//   1. Verify the signature against STRIPE_WEBHOOK_SECRET.
//   2. Use the admin (service-role) Supabase client to update the
//      profile, upsert the subscription row, and dispatch the right
//      email — RLS doesn't apply to the admin client, so we can
//      write to any user's row safely.
//   3. Always return 200 quickly. Email failures don't 500.
export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig!,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    return NextResponse.json({ error: `Webhook signature failed: ${err.message}` }, { status: 400 });
  }

  const admin = createAdminClient();

  // Idempotency guard — record the event ID so duplicate webhooks
  // (Stripe sometimes retries) become no-ops.
  const { data: existing } = await admin
    .from('stripe_events')
    .select('id')
    .eq('id', event.id)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ received: true, duplicate: true });
  }
  await admin.from('stripe_events').insert({
    id: event.id,
    type: event.type,
    payload: event as any,
    processed_at: new Date().toISOString(),
  });

  async function setPlan(userId: string, plan: 'pro' | 'free', customerId?: string) {
    const update: Record<string, any> = { plan };
    if (customerId) update.stripe_customer_id = customerId;
    await admin.from('profiles').update(update).eq('id', userId);
  }

  async function upsertSubscription(sub: Stripe.Subscription, userId: string) {
    // Stripe API typings sometimes lag — these timestamp fields are
    // present at runtime but not always in the static types.
    const s = sub as any;
    await admin.from('subscriptions').upsert({
      user_id: userId,
      stripe_subscription_id: sub.id,
      status: sub.status,
      plan_interval: sub.items.data[0]?.price?.recurring?.interval === 'year' ? 'annual' : 'monthly',
      current_period_start: s.current_period_start ? new Date(s.current_period_start * 1000).toISOString() : null,
      current_period_end: s.current_period_end ? new Date(s.current_period_end * 1000).toISOString() : null,
      cancel_at_period_end: !!sub.cancel_at_period_end,
      canceled_at: s.canceled_at ? new Date(s.canceled_at * 1000).toISOString() : null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'stripe_subscription_id' });
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.supabase_user_id || session.client_reference_id;
      if (userId) {
        await setPlan(userId, 'pro', session.customer as string);
      }
      break;
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = sub.customer as string;
      const { data: profile } = await admin
        .from('profiles')
        .select('id')
        .eq('stripe_customer_id', customerId)
        .single();
      if (profile) {
        const active = sub.status === 'active' || sub.status === 'trialing';
        await setPlan(profile.id, active ? 'pro' : 'free');
        await upsertSubscription(sub, profile.id);
      }
      break;
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = sub.customer as string;
      const { data: profile } = await admin
        .from('profiles')
        .select('id, email, display_name')
        .eq('stripe_customer_id', customerId)
        .single();
      if (profile) {
        await setPlan(profile.id, 'free');
        await upsertSubscription(sub, profile.id);

        // Send the cancellation email. Stripe's period end is when
        // Pro access actually ends — that's the relevant date for
        // the user, not the immediate cancellation timestamp.
        if (profile.email) {
          const s = sub as any;
          const accessEndsAt = s.current_period_end
            ? new Date(s.current_period_end * 1000)
            : new Date();
          const { subject, html, text } = cancellationEmail({
            displayName: profile.display_name,
            accessEndsAt,
          });
          await sendEmail({ to: profile.email, subject, html, text });
        }
      }
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
