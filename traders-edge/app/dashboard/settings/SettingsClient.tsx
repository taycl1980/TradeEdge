'use client';

import { useState } from 'react';

type Profile = {
  email: string | null;
  display_name: string | null;
  plan: string;
  stripe_customer_id: string | null;
  analysis_count: number;
  created_at: string;
};

type Subscription = {
  status: string | null;
  plan_interval: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
};

export default function SettingsClient({
  userEmail, profile, subscription, freeAnalysisCap,
}: {
  userEmail: string;
  profile: Profile | null;
  subscription: Subscription | null;
  freeAnalysisCap: number;
}) {
  const [openingPortal, setOpeningPortal] = useState(false);
  const [error, setError] = useState('');

  const plan = profile?.plan || 'free';
  const isPro = plan === 'pro';

  async function openPortal() {
    setOpeningPortal(true);
    setError('');
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.message || 'Could not open billing portal');
      }
      const json = await res.json();
      window.location.href = json.url;
    } catch (e: any) {
      setError(e.message || 'Something went wrong');
      setOpeningPortal(false);
    }
  }

  async function startUpgrade(planChoice: 'monthly' | 'annual') {
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planChoice }),
      });
      if (!res.ok) throw new Error('Could not start checkout');
      const json = await res.json();
      window.location.href = json.url;
    } catch (e: any) {
      setError(e.message || 'Something went wrong');
    }
  }

  // Format renewal date
  let renewalLabel = '—';
  if (subscription?.current_period_end) {
    const d = new Date(subscription.current_period_end);
    renewalLabel = d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  return (
    <div style={S.page}>
      <header style={S.header}>
        <a href="/dashboard" style={S.backLink}>← Back to dashboard</a>
        <h1 style={S.h1}>Settings</h1>
      </header>

      <main style={S.main}>
        {error && <div style={S.errorBox}>{error}</div>}

        {/* ACCOUNT */}
        <section style={S.card}>
          <div style={S.cardH}>Account</div>
          <div style={S.row}>
            <span style={S.rowLabel}>Email</span>
            <span style={S.rowValue}>{userEmail}</span>
          </div>
          <div style={S.row}>
            <span style={S.rowLabel}>Member since</span>
            <span style={S.rowValue}>
              {profile?.created_at
                ? new Date(profile.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
                : '—'}
            </span>
          </div>
        </section>

        {/* BILLING */}
        <section style={S.card}>
          <div style={S.cardH}>Plan &amp; billing</div>

          <div style={S.planRow}>
            <div>
              <div style={S.planName}>{isPro ? 'Pro' : 'Free'}</div>
              <div style={S.planSub}>
                {isPro
                  ? `${subscription?.plan_interval === 'annual' ? '$89/year' : '$12/month'}`
                  : `${freeAnalysisCap} chart analyses per month · unlimited journaling`}
              </div>
            </div>
            <div style={{ ...S.planBadge, ...(isPro ? S.planBadgePro : S.planBadgeFree) }}>
              {isPro ? 'PRO' : 'FREE'}
            </div>
          </div>

          {isPro && subscription && (
            <>
              <div style={S.row}>
                <span style={S.rowLabel}>
                  {subscription.cancel_at_period_end ? 'Access ends' : 'Next renewal'}
                </span>
                <span style={S.rowValue}>{renewalLabel}</span>
              </div>
              {subscription.cancel_at_period_end && (
                <div style={S.cancelNotice}>
                  Your subscription is set to cancel on {renewalLabel}. You keep Pro access until then.
                </div>
              )}
            </>
          )}

          <div style={S.usageRow}>
            <span style={S.rowLabel}>Analyses used this month</span>
            <span style={S.rowValue}>
              {profile?.analysis_count ?? 0}{!isPro && ` / ${freeAnalysisCap}`}
            </span>
          </div>

          {/* Action buttons depend on whether they have a Stripe customer */}
          <div style={S.actionRow}>
            {isPro || profile?.stripe_customer_id ? (
              <button
                style={S.primaryBtn}
                onClick={openPortal}
                disabled={openingPortal}
              >
                {openingPortal ? 'Opening…' : 'Manage subscription'}
              </button>
            ) : (
              <>
                <button style={S.primaryBtn} onClick={() => startUpgrade('monthly')}>
                  Upgrade — $12/month
                </button>
                <button style={S.ghostBtn} onClick={() => startUpgrade('annual')}>
                  $89/year (save 38%)
                </button>
              </>
            )}
          </div>

          <div style={S.helpText}>
            {isPro
              ? 'Cancel, pause, change card, or download receipts in the Stripe billing portal. You can re-subscribe anytime.'
              : 'Upgrade unlocks unlimited chart analyses, screenshot uploads on logged trades, and the full edge-validation engine at 30 trades.'}
          </div>
        </section>

        {/* EMAIL PREFERENCES — placeholder for now */}
        <section style={S.card}>
          <div style={S.cardH}>Email</div>
          <div style={S.helpText}>
            You currently receive only essential emails: welcome, billing receipts, cap warnings, and cancellation confirmations.
            Per-email preferences will arrive in a later update. To opt out entirely, reply to any email and we&apos;ll remove you.
          </div>
        </section>

        {/* DANGER ZONE — account deletion */}
        <section style={{ ...S.card, ...S.dangerCard }}>
          <div style={S.cardH}>Danger zone</div>
          <div style={S.helpText}>
            Need to delete your account and all data? Email{' '}
            <a href="mailto:support@example.com" style={S.link}>support@example.com</a> from your
            account email and we&apos;ll process it within 7 days, in line with the privacy policy.
            Self-serve account deletion is on the roadmap.
          </div>
        </section>

        <div style={S.footer}>
          <a href="/legal/terms" style={S.footerLink}>Terms</a>
          <span style={S.footerSep}>·</span>
          <a href="/legal/privacy" style={S.footerLink}>Privacy</a>
          <span style={S.footerSep}>·</span>
          <a href="/legal/refund" style={S.footerLink}>Refund policy</a>
          <span style={S.footerSep}>·</span>
          <a href="/legal/disclaimer" style={S.footerLink}>Disclaimer</a>
        </div>
      </main>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#faf7f2',
    color: '#1a1816',
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  header: {
    padding: '24px 28px 12px',
    borderBottom: '1px solid rgba(60,40,15,.08)',
    background: '#fffdf9',
  },
  backLink: {
    fontSize: 12.5,
    color: '#5d564d',
    textDecoration: 'none',
    fontFamily: 'JetBrains Mono, monospace',
  },
  h1: {
    fontFamily: 'Source Serif 4, Georgia, serif',
    fontSize: 30,
    fontWeight: 600,
    marginTop: 10,
    letterSpacing: '-0.01em',
  },
  main: {
    maxWidth: 680,
    margin: '0 auto',
    padding: '28px 20px 80px',
  },
  errorBox: {
    background: 'rgba(176,74,37,.08)',
    color: '#b04a25',
    border: '1px solid rgba(176,74,37,.22)',
    padding: '11px 14px',
    borderRadius: 9,
    fontSize: 13,
    marginBottom: 16,
  },
  card: {
    background: '#fffdf9',
    border: '1px solid rgba(60,40,15,.08)',
    borderRadius: 14,
    padding: '20px 22px',
    marginBottom: 14,
    boxShadow: '0 1px 0 rgba(60,40,15,.03)',
  },
  dangerCard: {
    borderColor: 'rgba(176,74,37,.18)',
  },
  cardH: {
    fontSize: 11.5,
    fontWeight: 600,
    color: '#5d564d',
    textTransform: 'uppercase',
    letterSpacing: '.06em',
    marginBottom: 14,
    fontFamily: 'JetBrains Mono, monospace',
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '9px 0',
    borderBottom: '1px solid rgba(60,40,15,.05)',
    fontSize: 13.5,
  },
  rowLabel: { color: '#5d564d' },
  rowValue: { color: '#1a1816', fontWeight: 500 },
  planRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '4px 0 14px',
    borderBottom: '1px solid rgba(60,40,15,.08)',
    marginBottom: 4,
  },
  planName: {
    fontFamily: 'Source Serif 4, Georgia, serif',
    fontSize: 22,
    fontWeight: 600,
    letterSpacing: '-0.01em',
  },
  planSub: { fontSize: 12.5, color: '#5d564d', marginTop: 3 },
  planBadge: {
    fontSize: 10,
    fontWeight: 700,
    padding: '4px 10px',
    borderRadius: 4,
    letterSpacing: '.06em',
    fontFamily: 'JetBrains Mono, monospace',
  },
  planBadgePro: {
    background: 'linear-gradient(135deg, #0a7c5f, #0a5c45)',
    color: '#fffdf9',
  },
  planBadgeFree: {
    background: '#f4efe6',
    color: '#5d564d',
  },
  cancelNotice: {
    background: 'rgba(162,106,24,.09)',
    color: '#a26a18',
    padding: '10px 12px',
    borderRadius: 7,
    fontSize: 12.5,
    margin: '10px 0',
    border: '1px solid rgba(162,106,24,.18)',
    lineHeight: 1.55,
  },
  usageRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '11px 0',
    fontSize: 13.5,
  },
  actionRow: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
    marginTop: 14,
    paddingTop: 14,
    borderTop: '1px solid rgba(60,40,15,.05)',
  },
  primaryBtn: {
    background: '#0a7c5f',
    color: '#fffdf9',
    border: 'none',
    borderRadius: 7,
    padding: '11px 22px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  ghostBtn: {
    background: 'transparent',
    color: '#1a1816',
    border: '1px solid rgba(60,40,15,.16)',
    borderRadius: 7,
    padding: '11px 18px',
    fontSize: 14,
    cursor: 'pointer',
  },
  helpText: {
    fontSize: 12.5,
    color: '#5d564d',
    lineHeight: 1.6,
    marginTop: 12,
  },
  link: { color: '#0a7c5f', textDecoration: 'underline' },
  footer: {
    marginTop: 28,
    textAlign: 'center' as const,
    fontSize: 12,
    color: '#8f8678',
  },
  footerLink: { color: '#5d564d', textDecoration: 'underline' },
  footerSep: { margin: '0 8px', color: '#a59c8e' },
};
