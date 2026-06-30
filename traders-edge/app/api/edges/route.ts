import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { getActiveEdge, createEdge, saveNewEdgeVersion } from '@/lib/edgeRepo';
import { validateEdgeConfig } from '@/lib/domain/edge';

export const runtime = 'nodejs';

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const active = await getActiveEdge(supabase, user.id);
  return NextResponse.json({ edge: active });
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body?.config) return NextResponse.json({ error: 'Missing config' }, { status: 400 });

  const problems = validateEdgeConfig(body.config);
  if (problems.length) return NextResponse.json({ error: 'invalid_edge', problems }, { status: 400 });

  try {
    const result = await createEdge(supabase, user.id, body.config);
    await supabase.from('profiles').update({ onboarding_completed_at: new Date().toISOString() }).eq('id', user.id);
    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to create edge' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body?.edgeId || !body?.config) {
    return NextResponse.json({ error: 'Missing edgeId or config' }, { status: 400 });
  }

  const problems = validateEdgeConfig(body.config);
  if (problems.length) return NextResponse.json({ error: 'invalid_edge', problems }, { status: 400 });

  try {
    const result = await saveNewEdgeVersion(supabase, user.id, body.edgeId, body.config);
    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to save edge' }, { status: 500 });
  }
}
