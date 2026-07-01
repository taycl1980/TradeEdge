import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase-server';
import { checkRateLimit } from '@/lib/rate-limit';
import { underDailyCap, incrementDailyCap } from '@/lib/spend-cap';
import { getActiveEdge } from '@/lib/edgeRepo';
import { buildAnalysisPrompt, scoreVerdict } from '@/lib/domain/edge';

export const runtime = 'nodejs';
export const maxDuration = 60;

const FREE_CAP = parseInt(process.env.FREE_ANALYSIS_CAP || '3', 10);
const MAX_IMAGE_MB = parseInt(process.env.MAX_IMAGE_MB || '5', 10);

// The Anthropic client lives ONLY here, server-side. The API key never
// reaches the browser — this is the core security boundary.
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function POST(req: NextRequest) {
  const supabase = createClient();

  // 1) Require a logged-in user.
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // 2) RATE LIMIT — per user and per IP, before any DB or AI work.
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const rlUser = await checkRateLimit(`user:${user.id}`);
  const rlIp = await checkRateLimit(`ip:${ip}`);
  if (!rlUser.ok || !rlIp.ok) {
    return NextResponse.json(
      { error: 'rate_limited', message: 'Too many requests — slow down a moment.' },
      { status: 429 }
    );
  }

  // 3) GLOBAL DAILY SPEND CAP — hard backstop on app-wide AI cost.
  if (!(await underDailyCap())) {
    return NextResponse.json(
      { error: 'service_busy', message: 'Analysis is temporarily at capacity. Please try again later.' },
      { status: 503 }
    );
  }

  // 4) Load plan + usage.
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan, analysis_count')
    .eq('id', user.id)
    .single();
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  // 5) Enforce the per-user free cap BEFORE spending money.
  if (profile.plan !== 'pro' && profile.analysis_count >= FREE_CAP) {
    return NextResponse.json({ error: 'cap_reached', cap: FREE_CAP }, { status: 402 });
  }

  // 6) SECURITY: fetch the user's edge from the database — never trust a
  //    client-supplied prompt. The browser only ever sends the image.
  //    This closes the "client could send any prompt it wants" gap.
  const activeEdge = await getActiveEdge(supabase, user.id);
  if (!activeEdge) {
    return NextResponse.json(
      { error: 'no_edge', message: 'Set up your edge before analyzing a chart.' },
      { status: 409 }
    );
  }

  // 7) Validate the payload — image only, no prompt field accepted.
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }
  const { imageBase64, imageType } = body;
  if (!imageBase64 || !imageType) {
    return NextResponse.json({ error: 'Missing image' }, { status: 400 });
  }
  if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(imageType)) {
    return NextResponse.json({ error: 'Unsupported image type' }, { status: 400 });
  }

  // 7b) IMAGE SIZE GUARD
  const approxBytes = Math.floor(imageBase64.length * 0.75);
  if (approxBytes > MAX_IMAGE_MB * 1024 * 1024) {
    return NextResponse.json(
      { error: 'image_too_large', message: `Image exceeds ${MAX_IMAGE_MB}MB. Please upload a smaller screenshot.` },
      { status: 413 }
    );
  }

  // 8) Build the prompt SERVER-SIDE from the trusted, stored edge config.
  //    User-supplied factor/rule text is delimited inside the prompt
  //    builder itself (see lib/domain/edge.ts) as a prompt-injection guard.
  const prompt = buildAnalysisPrompt(activeEdge.config);

  // 9) Call Claude with the chart + the server-built prompt.
  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: imageType, data: imageBase64 } },
            { type: 'text', text: prompt },
          ],
        },
      ],
    });

    // If Claude ran out of room before finishing, the JSON will be
    // truncated and unparseable. Detect this explicitly rather than
    // waiting for JSON.parse to fail blind — gives a much clearer
    // signal in logs and lets us tell the user to just retry instead
    // of showing a generic parse error.
    if (message.stop_reason === 'max_tokens') {
      console.error('[analyze] truncated at max_tokens', {
        userId: user.id,
        outputTokens: message.usage?.output_tokens,
      });
      return NextResponse.json(
        { error: 'response_truncated', message: 'The analysis ran longer than expected — please try again.' },
        { status: 500 }
      );
    }

    const text = message.content
      .map((b) => (b.type === 'text' ? b.text : ''))
      .join('')
      .replace(/```json|```/g, '')
      .trim();

    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      // Log the raw text server-side so we can see exactly what shape
      // broke parsing, without exposing potentially-large raw model
      // output back to the client in production.
      console.error('[analyze] JSON parse failed', { userId: user.id, rawPreview: text.slice(0, 500) });
      return NextResponse.json(
        { error: 'parse_failed', message: 'Could not read the analysis — please try again.' },
        { status: 500 }
      );
    }

    // Recompute the verdict server-side from the trusted thresholds rather
    // than trusting the model's own verdict string outright — belt and
    // suspenders against a malformed or manipulated response.
    const verdict = scoreVerdict(Number(parsed.score) || 0, activeEdge.config);

    // 10) Persist the analysis row (the moat: this becomes linkable to a
    //     trade outcome later, and feeds the v2 edge-validation engine).
    const { data: savedAnalysis } = await supabase
      .from('analyses')
      .insert({
        user_id: user.id,
        edge_version_id: activeEdge.versionId,
        timeframe: parsed.meta?.timeframe || null,
        detected_bias: parsed.meta?.bias || null,
        verdict,
        score: Number(parsed.score) || 0,
        max_score: Number(parsed.maxScore) || 0,
        result: parsed,
        source: 'web',
      })
      .select('id')
      .single();

    // 11) Only now (success) increment usage counters.
    const { data: newCount } = await supabase.rpc('increment_analysis', { uid: user.id });
    await incrementDailyCap();

    // 12) Cap-warning email at the threshold (cap - 1), fire-and-forget.
    //     Only for free users, only once per cycle, never blocking the
    //     response. The cap_warning_sent_at flag is reset by a cron in
    //     a later build when the monthly cycle rolls — for now it's
    //     a one-shot per account, which is the right default.
    if (profile.plan !== 'pro' && typeof newCount === 'number' && newCount === FREE_CAP - 1) {
      // Async IIFE so the response can return without waiting on email
      // dispatch, and so we get a real Promise (Supabase returns
      // PromiseLike which lacks .catch).
      (async () => {
        try {
          const { data: p } = await supabase
            .from('profiles')
            .select('email, display_name, cap_warning_sent_at')
            .eq('id', user.id)
            .single();
          if (!p || p.cap_warning_sent_at || !p.email) return;
          const [{ count: tradesLogged }, { count: compliantCount }] = await Promise.all([
            supabase.from('trades').select('id', { count: 'exact', head: true }).eq('user_id', user.id).is('deleted_at', null),
            supabase.from('trades').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('rule_compliant', true).is('deleted_at', null),
          ]);
          const total = tradesLogged ?? 0;
          const compliant = compliantCount ?? 0;
          const compliancePct = total > 0 ? Math.round((compliant / total) * 100) : 0;
          const { capWarningEmail } = await import('@/lib/email/templates');
          const { sendEmail } = await import('@/lib/email/send');
          const { subject, html, text } = capWarningEmail({
            displayName: p.display_name,
            analysesUsed: newCount,
            analysesCap: FREE_CAP,
            tradesLogged: total,
            compliancePct,
          });
          const r = await sendEmail({ to: p.email, subject, html, text });
          if (r.ok) {
            await supabase
              .from('profiles')
              .update({ cap_warning_sent_at: new Date().toISOString() })
              .eq('id', user.id);
          }
        } catch { /* logged in sendEmail */ }
      })();
    }

    return NextResponse.json({
      analysisId: savedAnalysis?.id ?? null,
      analysis: { ...parsed, verdict },
      usage: { count: newCount ?? profile.analysis_count + 1, cap: FREE_CAP, plan: profile.plan },
    });
  } catch (err: any) {
    return NextResponse.json({ error: 'Analysis failed', detail: err?.message ?? 'unknown' }, { status: 500 });
  }
}
