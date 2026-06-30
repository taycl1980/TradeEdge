import { SupabaseClient } from '@supabase/supabase-js';
import { EdgeConfig } from '@/lib/domain/edge';

// Fetches the user's active edge + its current version config.
// Returns null if the user has no edge yet (route to onboarding).
export async function getActiveEdge(
  supabase: SupabaseClient,
  userId: string
): Promise<{ edgeId: string; versionId: string; config: EdgeConfig } | null> {
  const { data: edge } = await supabase
    .from('edges')
    .select('id, current_version')
    .eq('user_id', userId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!edge) return null;

  const { data: version } = await supabase
    .from('edge_versions')
    .select('id, config')
    .eq('edge_id', edge.id)
    .eq('version', edge.current_version)
    .maybeSingle();

  if (!version) return null;

  return { edgeId: edge.id, versionId: version.id, config: version.config as EdgeConfig };
}

// Creates a brand-new edge with its first version (version 1).
export async function createEdge(
  supabase: SupabaseClient,
  userId: string,
  config: EdgeConfig
): Promise<{ edgeId: string; versionId: string }> {
  const { data: edge, error: edgeErr } = await supabase
    .from('edges')
    .insert({ user_id: userId, name: config.name, current_version: 1 })
    .select('id')
    .single();
  if (edgeErr || !edge) throw new Error(edgeErr?.message || 'Failed to create edge');

  const { data: version, error: versionErr } = await supabase
    .from('edge_versions')
    .insert({ edge_id: edge.id, version: 1, config })
    .select('id')
    .single();
  if (versionErr || !version) throw new Error(versionErr?.message || 'Failed to create edge version');

  return { edgeId: edge.id, versionId: version.id };
}

// Saves an EDIT to an existing edge as a NEW version (snapshot pattern —
// past trades/analyses keep pointing at the old version's config so
// historical review stays honest even after the user changes their rules).
export async function saveNewEdgeVersion(
  supabase: SupabaseClient,
  userId: string,
  edgeId: string,
  config: EdgeConfig
): Promise<{ versionId: string }> {
  const { data: edge, error: getErr } = await supabase
    .from('edges')
    .select('current_version')
    .eq('id', edgeId)
    .eq('user_id', userId)
    .single();
  if (getErr || !edge) throw new Error('Edge not found');

  const nextVersion = edge.current_version + 1;

  const { data: version, error: versionErr } = await supabase
    .from('edge_versions')
    .insert({ edge_id: edgeId, version: nextVersion, config })
    .select('id')
    .single();
  if (versionErr || !version) throw new Error(versionErr?.message || 'Failed to save edge version');

  await supabase
    .from('edges')
    .update({ current_version: nextVersion, name: config.name, updated_at: new Date().toISOString() })
    .eq('id', edgeId)
    .eq('user_id', userId);

  return { versionId: version.id };
}
