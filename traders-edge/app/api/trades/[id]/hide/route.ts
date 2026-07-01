import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { appendAudit } from '@/lib/tradesRepo';

export const runtime = 'nodejs';

// POST /api/trades/[id]/hide — Soft-delete a trade. Hidden trades stay
// in the table and audit history but are excluded from stats and the
// active log view. Reason is required and stored.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { reason, note } = await req.json().catch(() => ({}));
  if (!reason) return NextResponse.json({ error: 'reason required' }, { status: 400 });

  const { data: trade } = await supabase
    .from('trades').select('audit_log')
    .eq('id', params.id).eq('user_id', user.id).single();
  if (!trade) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const fullReason = note ? `${reason} — ${note}` : reason;
  const { error } = await supabase
    .from('trades')
    .update({
      hidden: true,
      hidden_reason: fullReason,
      audit_log: appendAudit(trade.audit_log ?? [], { action: 'hidden', reason: fullReason }),
    })
    .eq('id', params.id)
    .eq('user_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE /api/trades/[id]/hide — Restore a hidden trade to active stats.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { data: trade } = await supabase
    .from('trades').select('audit_log')
    .eq('id', params.id).eq('user_id', user.id).single();
  if (!trade) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { error } = await supabase
    .from('trades')
    .update({
      hidden: false,
      hidden_reason: null,
      audit_log: appendAudit(trade.audit_log ?? [], { action: 'restored', note: 'reinstated to active stats' }),
    })
    .eq('id', params.id)
    .eq('user_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
