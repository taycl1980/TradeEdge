import Link from 'next/link';

export default function LegalShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#faf7f2',
        color: '#1a1816',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '48px 24px 80px', lineHeight: 1.7 }}>
        <Link href="/" style={{ color: '#5d564d', textDecoration: 'none', fontSize: 13, fontFamily: "'JetBrains Mono', monospace" }}>
          ← Back
        </Link>
        <h1
          style={{
            fontFamily: "'Source Serif 4', Georgia, serif",
            fontSize: 32,
            fontWeight: 600,
            margin: '20px 0 8px',
            letterSpacing: '-0.01em',
            lineHeight: 1.15,
          }}
        >
          {title}
        </h1>
        <p style={{ color: '#8f8678', fontSize: 12, marginBottom: 28 }}>Last updated: June 2026</p>
        <div style={{ color: '#3a3530', fontSize: 14.5 }}>{children}</div>
        <div
          style={{
            marginTop: 40,
            padding: 16,
            background: 'rgba(162,106,24,.09)',
            border: '1px solid rgba(162,106,24,.22)',
            borderRadius: 10,
            color: '#a26a18',
            fontSize: 12.5,
          }}
        >
          This is a starting template, not legal advice. Have a qualified lawyer in your jurisdiction
          review and adapt all legal pages before you take payment.
        </div>
      </div>
    </main>
  );
}

export const legalStyles = {
  h2: {
    fontFamily: "'Source Serif 4', Georgia, serif",
    fontSize: 20,
    fontWeight: 600,
    margin: '26px 0 10px',
    color: '#1a1816',
    letterSpacing: '-0.005em',
  } as React.CSSProperties,
  p: { marginBottom: 12 } as React.CSSProperties,
  link: { color: '#0a7c5f', textDecoration: 'underline' } as React.CSSProperties,
};
