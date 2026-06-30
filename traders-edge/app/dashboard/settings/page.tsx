import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';
import SettingsClient from './SettingsClient';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('email, display_name, plan, stripe_customer_id, analysis_count, created_at')
    .eq('id', user.id)
    .single();

  // Latest subscription (if any) — gives renewal date and cancel state.
  // We deliberately don't surface card details here; the Stripe portal
  // is the source of truth for that.
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('status, plan_interval, current_period_end, cancel_at_period_end, canceled_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <SettingsClient
      userEmail={user.email ?? ''}
      profile={profile ?? null}
      subscription={subscription ?? null}
      freeAnalysisCap={parseInt(process.env.FREE_ANALYSIS_CAP || '3', 10)}
    />
  );
}
