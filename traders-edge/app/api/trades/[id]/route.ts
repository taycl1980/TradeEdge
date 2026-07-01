import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { appendAudit } from '@/lib/tradesRepo';
import { tierEditPermissions } from '@/lib/domain/trades';

export const runtime = 'nodejs';

// PATCH /api/trades/[id] — Apply a tier-aware edit. The server enforces
// which fields can be changed based on current status:
//   open     : Tier 1 + 2 + 3 freely
//   closed   : Tier 2 + 3 (Tier 2 needs reason)
//   locked   : Tier 3 only
//   superseded: nothing (this row is history)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { data: trade } = await supabase
    .from('trades')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single();
  if (!trade) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (trade.status === 'superseded') {
    return NextResponse.json({ error: 'superseded trades are immutable' }, { status: 400 });
  }

  const perms = tierEditPermissions(trade.status);
  const body = await req.json().catch(() => ({}));
  const updates: Record<string, any> = {};
  const t1Changes: string[] = [];
  const t2Changes: string[] = [];

  // Tier 1 — execution math
  if (perms.canEditTier1) {
    for (const [k, dbCol] of [
      ['entry', 'entry_price'], ['stop', 'stop_loss'],
      ['takeProfit', 'take_profit'], ['exit', 'exit_price'],
      ['direction', 'direction'],
    ] as const) {
      if (body[k] != null && body[k] !== trade[dbCol]) {
        t1Changes.push(`${dbCol}: ${trade[dbCol]}→${body[k]}`);
        updates[dbCol] = body[k];
      }
    }
  }

  // Tier 2 — classification
  if (perms.canEditTier2) {
    if (body.confluenceScore != null && body.confluenceScore !== trade.confluence_score) {
      t2Changes.push(`confluence: ${trade.confluence_score}→${body.confluenceScore}`);
      updates.confluence_score = Number(body.confluenceScore);
    }
    if (body.compliant != null && body.compliant !== trade.rule_compliant) {
      t2Changes.push(`rule_compliant: ${trade.rule_compliant}→${body.compliant}`);
      updates.rule_compliant = !!body.compliant;
    }
    if (body.sessionId != null && body.sessionId !== trade.session_id) {
      t2Changes.push(`session_id: ${trade.session_id}→${body.sessionId}`);
      updates.session_id = body.sessionId;
    }
    if (body.patternId != null && body.patternId !== trade.pattern_id) {
      t2Changes.push(`pattern_id: ${trade.pattern_id}→${body.patternId}`);
      updates.pattern_id = body.patternId;
    }
  }

  // Tier 3 — reflection (always allowed unless superseded)
  if (perms.canEditTier3) {
    if (body.emotion !== undefined) updates.emotion = body.emotion;
    if (body.notesRight !== undefined) updates.notes_right = body.notesRight;
    if (body.notesWrong !== undefined) updates.notes_wrong = body.notesWrong;
  }

  // Tier 2 edits on closed/locked trades require a reason.
  if (perms.tier2RequiresReason && t2Changes.length > 0 && !body.reason) {
    return NextResponse.json(
      { error: 'reason required for tier-2 edits on closed trades' },
      { status: 400 }
    );
  }

  // Build audit log entries for any tracked changes.
  let auditLog = trade.audit_log ?? [];
  if (t1Changes.length) auditLog = appendAudit(auditLog, { action: 'tier-1 edit', note: t1Changes.join(', ') });
  if (t2Changes.length) auditLog = appendAudit(auditLog, { action: 'tier-2 edit', reason: body.reason, note: t2Changes.join(', ') });
  if (t1Changes.length || t2Changes.length) updates.audit_log = auditLog;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: true, noop: true });
  }

  const { error } = await supabase
    .from('trades')
    .update(updates)
    .eq('id', params.id)
    .eq('user_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
