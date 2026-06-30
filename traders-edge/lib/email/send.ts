// Email sender. Wraps Resend's SDK with three properties:
//   1) If RESEND_API_KEY is not set, sending is a logged no-op rather
//      than a hard failure. This lets you ship to production without
//      blocking on email setup, and keeps local dev frictionless.
//   2) Every send is wrapped in try/catch — email failures never block
//      a webhook ack or a user-facing API response.
//   3) A single FROM address comes from EMAIL_FROM so domain changes
//      are one env var, not a code search.
//
// Setup:
//   1. Create a Resend account, add and verify your sending domain.
//   2. Set RESEND_API_KEY and EMAIL_FROM in Vercel env vars.
//   3. EMAIL_FROM should be 'Trader's Edge <hello@your-domain.com>' format.

import { Resend } from 'resend';

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.EMAIL_FROM || "Trader's Edge <hello@example.com>";

// Lazily instantiated so the module loads even without a key configured.
let _resend: Resend | null = null;
function client(): Resend | null {
  if (!apiKey) return null;
  if (!_resend) _resend = new Resend(apiKey);
  return _resend;
}

export type SendArgs = {
  to: string;
  subject: string;
  html: string;
  // Plain-text fallback. Important for deliverability — Gmail's
  // promotions filter penalises HTML-only messages.
  text: string;
};

export async function sendEmail(args: SendArgs): Promise<{ ok: boolean; reason?: string }> {
  const c = client();
  if (!c) {
    // Logged no-op so we can see what *would* have been sent without
    // failing the request. Set RESEND_API_KEY to actually deliver.
    console.log('[email:noop]', args.to, '-', args.subject);
    return { ok: false, reason: 'no_api_key' };
  }
  try {
    await c.emails.send({
      from,
      to: args.to,
      subject: args.subject,
      html: args.html,
      text: args.text,
    });
    return { ok: true };
  } catch (err: any) {
    // Never throw from here. Email is a side-channel — if it fails,
    // the caller (a webhook, an API route) must still succeed.
    console.error('[email:error]', args.to, '-', args.subject, err?.message || err);
    return { ok: false, reason: err?.message || 'unknown' };
  }
}
