import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';
import { getActiveEdge } from '@/lib/edgeRepo';
import DashboardClient from './DashboardClient';

export default async function DashboardPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('plan, analysis_count, email')
    .eq('id', user.id)
    .single();

  // No default edge, ever. If the user has none, send them to the builder.
  const activeEdge = await getActiveEdge(supabase, user.id);
  if (!activeEdge) redirect('/edge-builder');

  return (
    <DashboardClient
      userEmail={user.email ?? ''}
      plan={profile?.plan ?? 'free'}
      analysisCount={profile?.analysis_count ?? 0}
      cap={parseInt(process.env.FREE_ANALYSIS_CAP || '3', 10)}
      edgeId={activeEdge.edgeId}
      edge={activeEdge.config}
    />
  );
}
