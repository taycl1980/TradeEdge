'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase-browser';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  async function signInWithEmail() {
    if (!email) return;
    setLoading(true);
    await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    });
    setSent(true);
    setLoading(false);
  }

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/auth/callback` },
    });
  }

  return (
    <main style={styles.wrap}>
      <div style={styles.card}>
        <div style={styles.brand}>
          <div style={styles.mark}>◎</div>
          <span style={styles.brandName}>Trader&apos;s Edge</span>
        </div>
        <h1 style={styles.h1}>Sign in</h1>
        <p style={styles.sub}>Build your discipline engine. Free to start.</p>

        {sent ? (
          <div style={styles.notice}>
            Check your email for a magic sign-in link.
          </div>
        ) : (
          <>
            <button onClick={signInWithGoogle} style={styles.googleBtn}>
              Continue with Google
            </button>
            <div style={styles.divider}><span style={styles.dividerText}>or</span></div>
            <input
              type="email"
              placeholder="you@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={styles.input}
            />
            <button onClick={signInWithEmail} disabled={loading} style={styles.primaryBtn}>
              {loading ? 'Sending…' : 'Email me a magic link'}
            </button>
          </>
        )}

        <p style={styles.legal}>
          By continuing you agree to our{' '}
          <a href="/legal/terms" style={styles.link}>Terms</a>,{' '}
          <a href="/legal/privacy" style={styles.link}>Privacy Policy</a>, and{' '}
          <a href="/legal/disclaimer" style={styles.link}>Risk Disclaimer</a>.
        </p>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d1526', padding: 20, fontFamily: 'system-ui, sans-serif' },
  card: { width: '100%', maxWidth: 380, background: '#15203a', border: '1px solid rgba(255,255,255,.1)', borderRadius: 16, padding: 32 },
  brand: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 },
  mark: { width: 38, height: 38, borderRadius: 10, background: 'linear-gradient(135deg,#1d9e75,#0f6e56)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 20 },
  brandName: { color: '#eef2f8', fontWeight: 700, fontSize: 17 },
  h1: { color: '#eef2f8', fontSize: 22, marginBottom: 6 },
  sub: { color: '#9fb0c9', fontSize: 13, marginBottom: 22 },
  googleBtn: { width: '100%', padding: '11px', borderRadius: 9, border: '1px solid rgba(255,255,255,.16)', background: '#fff', color: '#15233f', fontWeight: 600, fontSize: 14, cursor: 'pointer' },
  divider: { textAlign: 'center', margin: '16px 0', borderTop: '1px solid rgba(255,255,255,.1)', position: 'relative' },
  dividerText: { position: 'relative', top: -10, background: '#15203a', padding: '0 10px', color: '#65769180', fontSize: 12 },
  input: { width: '100%', padding: '11px 12px', borderRadius: 9, border: '1px solid rgba(255,255,255,.12)', background: '#0d1526', color: '#eef2f8', fontSize: 14, marginBottom: 10 },
  primaryBtn: { width: '100%', padding: '11px', borderRadius: 9, border: 'none', background: '#1d9e75', color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer' },
  notice: { background: 'rgba(29,158,117,.14)', color: '#5ddca5', padding: 14, borderRadius: 9, fontSize: 13, textAlign: 'center' },
  legal: { color: '#65769180', fontSize: 11, marginTop: 18, lineHeight: 1.6 },
  link: { color: '#85b7eb', textDecoration: 'none' },
};
