import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';
import { getActiveEdge } from '@/lib/edgeRepo';
import { sendEmail } from '@/lib/email/send';
import { welcomeEmail } from '@/lib/email/templates';
import EdgeBuilderClient from './EdgeBuilderClient';

export default async function EdgeBuilderPage({ searchParams }: { searchParams: { edit?: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const existing = await getActiveEdge(supabase, user.id);
  const isEdit = searchParams.edit === '1';

  // New users with no edge: show the builder. Existing users land here only
  // via "My edge" with ?edit=1 — otherwise bounce them to the dashboard.
  if (existing && !isEdit) redirect('/dashboard');
  if (!existing && isEdit) redirect('/edge-builder');

  // Fire welcome email on first arrival to the edge builder, which is
  // the first authenticated page a brand-new signup hits. Guarded by
  // welcome_email_sent_at so it only fires once per account. Failing
  // to send is non-fatal — we just won't try again.
  if (!isEdit) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('welcome_email_sent_at, display_name')
      .eq('id', user.id)
      .single();
    if (profile && !profile.welcome_email_sent_at && user.email) {
      const { subject, html, text } = welcomeEmail({ displayName: profile.display_name });
      // Fire and forget — never block the page render on email.
      (async () => {
        try {
          const r = await sendEmail({ to: user.email!, subject, html, text });
          if (r.ok) {
            await supabase
              .from('profiles')
              .update({ welcome_email_sent_at: new Date().toISOString() })
              .eq('id', user.id);
          }
        } catch { /* logged in sendEmail */ }
      })();
    }
  }

  return <EdgeBuilderClient existingEdgeId={existing?.edgeId} existingConfig={existing?.config} />;
}
