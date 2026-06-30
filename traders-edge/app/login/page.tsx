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
  wrap: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#faf7f2', padding: 20, fontFamily: 'Inter, system-ui, sans-serif' },
  card: { width: '100%', maxWidth: 380, background: '#fffdf9', border: '1px solid rgba(60,40,15,.08)', borderRadius: 14, padding: 32, boxShadow: '0 1px 0 rgba(60,40,15,.03)' },
  brand: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 },
  mark: { width: 38, height: 38, borderRadius: 10, background: 'linear-gradient(135deg,#0a7c5f,#0a5c45)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fffdf9', fontSize: 20 },
  brandName: { color: '#1a1816', fontFamily: "'Source Serif 4', Georgia, serif", fontWeight: 600, fontSize: 18, letterSpacing: '-0.01em' },
  h1: { color: '#1a1816', fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 24, fontWeight: 600, marginBottom: 6, letterSpacing: '-0.01em' },
  sub: { color: '#5d564d', fontSize: 13, marginBottom: 22 },
  googleBtn: { width: '100%', padding: '11px', borderRadius: 7, border: '1px solid rgba(60,40,15,.16)', background: '#fffdf9', color: '#1a1816', fontWeight: 600, fontSize: 14, cursor: 'pointer' },
  divider: { textAlign: 'center', margin: '16px 0', borderTop: '1px solid rgba(60,40,15,.08)', position: 'relative' },
  dividerText: { position: 'relative', top: -10, background: '#fffdf9', padding: '0 10px', color: '#8f8678', fontSize: 12 },
  input: { width: '100%', padding: '11px 12px', borderRadius: 7, border: '1px solid rgba(60,40,15,.16)', background: '#fffdf9', color: '#1a1816', fontSize: 14, marginBottom: 10 },
  primaryBtn: { width: '100%', padding: '11px', borderRadius: 7, border: 'none', background: '#0a7c5f', color: '#fffdf9', fontWeight: 600, fontSize: 14, cursor: 'pointer' },
  notice: { background: 'rgba(10,124,95,.08)', color: '#0a7c5f', border: '1px solid rgba(10,124,95,.22)', padding: 14, borderRadius: 8, fontSize: 13, textAlign: 'center' },
  legal: { color: '#8f8678', fontSize: 11, marginTop: 18, lineHeight: 1.6 },
  link: { color: '#0a7c5f', textDecoration: 'underline' },
};
