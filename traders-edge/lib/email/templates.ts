// Transactional email templates. Each function returns the three
// fields the sender needs: subject, html body, and plain-text body.
//
// Rules followed across all three:
//   - Plain-text version is hand-written (not auto-stripped HTML).
//     Stripped HTML reads terribly in clients that fall back to text,
//     and the plain-text version is what helps deliverability.
//   - One primary CTA per email. Multiple CTAs split attention.
//   - The cancellation email never argues with the decision. Trying
//     to win back a cancelling user with the cancellation email
//     itself reads as desperate and damages the brand.
//   - Preheaders are written like inbox previews, not "Here is your
//     email" filler. They earn the open.

import { emailShell } from './shell';

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com';

// ---- WELCOME ---------------------------------------------------------
// Fires when a new user signs up. Goal: drop them into the lifecycle
// path with a clear next action (build their edge) and seed the
// product thesis so they understand WHY this app exists.
export function welcomeEmail(opts: { displayName?: string | null }) {
  const name = opts.displayName?.trim() || 'there';
  const subject = "Welcome to Trader's Edge — let's build your edge";
  const html = emailShell({
    preheader: 'Most traders fail evaluations on discipline, not strategy. Here is how this app helps.',
    ctaHref: `${siteUrl()}/edge-builder`,
    ctaLabel: 'Build your edge — 3 minutes',
    body: `
      <p>Hi ${escapeText(name)},</p>
      <p>Welcome aboard. You just joined a tool built around one belief:
      <strong>most traders fail prop firm evaluations on discipline, not strategy</strong>.
      So the product is a discipline engine, not a signal service.</p>
      <p>Three things to do in your first session:</p>
      <ol style="padding-left:18px;margin:14px 0;">
        <li style="margin-bottom:6px;"><strong>Build your edge</strong> — pick a template, edit the confluence factors and gate rules to match how <em>you</em> actually trade.</li>
        <li style="margin-bottom:6px;"><strong>Try the sample chart</strong> — see your edge score a real-looking setup before you upload your own.</li>
        <li><strong>Log your next trade</strong> — the quick logger takes about 30 seconds. The streak counter and the edge-validation engine grow from there.</li>
      </ol>
      <p>You get 3 free chart analyses every month, unlimited journaling, and the full insights engine. Pro ($12/month) unlocks unlimited analyses and chart screenshot uploads when you're ready.</p>
      <p>Reply to this email if you get stuck — a real human reads it.</p>
    `,
  });
  const text = `Welcome to Trader's Edge.

Most traders fail prop firm evaluations on discipline, not strategy. So this app is a discipline engine, not a signal service.

Three things to do in your first session:

1. Build your edge — pick a template, edit the confluence factors and gate rules to match how YOU trade.
2. Try the sample chart — see your edge score a real-looking setup before uploading your own.
3. Log your next trade — the quick logger takes ~30 seconds. The streak counter and validation engine grow from there.

You get 3 free chart analyses every month, unlimited journaling, and the full insights engine. Pro ($12/month) unlocks unlimited analyses and chart screenshot uploads.

Build your edge: ${siteUrl()}/edge-builder

Reply to this email if you get stuck — a real human reads it.`;
  return { subject, html, text };
}

// ---- CAP-WARNING -----------------------------------------------------
// Fires when a free user uses their 2nd analysis of the month. Goal:
// flag the cap *before* they spend their last one, with personalized
// stats that make the upgrade case quantitative rather than promotional.
export function capWarningEmail(opts: {
  displayName?: string | null;
  analysesUsed: number;
  analysesCap: number;
  tradesLogged: number;
  compliancePct: number;
}) {
  const name = opts.displayName?.trim() || 'there';
  const remaining = Math.max(0, opts.analysesCap - opts.analysesUsed);
  const subject = `You have ${remaining} free analysis left this month`;
  const html = emailShell({
    preheader: `You have used ${opts.analysesUsed} of ${opts.analysesCap} free analyses. Here is what is working so far.`,
    ctaHref: `${siteUrl()}/dashboard?upgrade=1`,
    ctaLabel: 'Go unlimited — $12/month',
    body: `
      <p>Hi ${escapeText(name)},</p>
      <p>Quick heads-up: you've used <strong>${opts.analysesUsed} of your ${opts.analysesCap}</strong> free chart analyses this month. ${remaining > 0 ? `You have <strong>${remaining}</strong> left — save it for a setup worth scoring.` : `That was your last one.`}</p>
      <p>Here's how you're doing so far:</p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:14px 0;border-collapse:collapse;">
        <tr>
          <td style="padding:10px 14px;background:#f4efe6;border-radius:7px 0 0 7px;font-size:13px;">
            <div style="color:#8f8678;font-size:11px;text-transform:uppercase;letter-spacing:0.04em;">Trades logged</div>
            <div style="font-size:20px;font-weight:600;color:#1a1816;margin-top:2px;">${opts.tradesLogged}</div>
          </td>
          <td style="padding:10px 14px;background:#f4efe6;border-radius:0 7px 7px 0;font-size:13px;border-left:1px solid rgba(60,40,15,0.08);">
            <div style="color:#8f8678;font-size:11px;text-transform:uppercase;letter-spacing:0.04em;">Compliance</div>
            <div style="font-size:20px;font-weight:600;color:#0a7c5f;margin-top:2px;">${opts.compliancePct}%</div>
          </td>
        </tr>
      </table>
      <p>Pro is $12/month or $89/year. You unlock:</p>
      <ul style="padding-left:18px;margin:8px 0;color:#3a3530;">
        <li>Unlimited chart analyses</li>
        <li>Chart screenshot uploads on every logged trade</li>
        <li>The full edge-validation engine once you cross 30 trades</li>
      </ul>
      <p style="font-size:13px;color:#5d564d;">Your discipline is worth more than $12/month. Cancel any time, two clicks from Settings.</p>
    `,
  });
  const text = `You have ${remaining} free chart analyses left this month (${opts.analysesUsed} of ${opts.analysesCap} used).

How you're doing so far:
  Trades logged: ${opts.tradesLogged}
  Compliance: ${opts.compliancePct}%

Pro is $12/month or $89/year and unlocks:
  - Unlimited chart analyses
  - Chart screenshot uploads on every logged trade
  - The full edge-validation engine once you cross 30 trades

Upgrade: ${siteUrl()}/dashboard?upgrade=1

Cancel any time, two clicks from Settings.`;
  return { subject, html, text };
}

// ---- CANCELLATION ----------------------------------------------------
// Fires when Stripe sends customer.subscription.deleted. Goal:
// graceful exit. We do NOT try to win them back here — that comes
// later as a separate win-back campaign. This email is logistical:
// when does access end, what data persists, what to expect.
export function cancellationEmail(opts: {
  displayName?: string | null;
  accessEndsAt: Date | string;
}) {
  const name = opts.displayName?.trim() || 'there';
  const endsAt = typeof opts.accessEndsAt === 'string'
    ? new Date(opts.accessEndsAt)
    : opts.accessEndsAt;
  const endsAtFormatted = endsAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const subject = 'Your subscription is cancelled';
  const html = emailShell({
    preheader: `Pro access continues until ${endsAtFormatted}. Your trade history stays intact.`,
    body: `
      <p>Hi ${escapeText(name)},</p>
      <p>Your Pro subscription is cancelled. Here's what that means:</p>
      <ul style="padding-left:18px;margin:14px 0;color:#3a3530;">
        <li style="margin-bottom:6px;"><strong>Pro access continues until ${escapeText(endsAtFormatted)}.</strong> You're not charged again.</li>
        <li style="margin-bottom:6px;"><strong>Your data stays.</strong> Every trade, every analysis, every streak day — all kept. Nothing is deleted when your plan downgrades.</li>
        <li style="margin-bottom:6px;"><strong>You return to the free tier.</strong> 3 chart analyses per month, unlimited journaling, full insights.</li>
        <li><strong>You can re-upgrade anytime</strong> from the dashboard — no penalty, no re-onboarding.</li>
      </ul>
      <p>Two-minute favour if you have it: <strong>reply to this email and tell me why you cancelled</strong>. One sentence is plenty. It's the single most useful signal I get about what the product is missing.</p>
      <p>Either way — thank you for trying it. Good luck on your evaluations.</p>
    `,
    footerNote: 'Receipts and invoices remain available in your Stripe billing portal.',
  });
  const text = `Your Pro subscription is cancelled.

What that means:
  - Pro access continues until ${endsAtFormatted}. You are not charged again.
  - Your data stays — every trade, every analysis, every streak day is kept.
  - You return to the free tier: 3 chart analyses per month, unlimited journaling, full insights.
  - You can re-upgrade anytime from the dashboard.

Two-minute favour: reply and tell me why you cancelled. One sentence is plenty. It's the single most useful signal about what the product is missing.

Either way — thank you for trying it. Good luck on your evaluations.

Receipts and invoices are in your Stripe billing portal.`;
  return { subject, html, text };
}

function escapeText(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
