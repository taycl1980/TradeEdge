import Link from 'next/link';

export default function LegalShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '48px 24px 80px', lineHeight: 1.7 }}>
      <Link href="/" style={{ color: '#85b7eb', textDecoration: 'none', fontSize: 13 }}>← Back</Link>
      <h1 style={{ fontSize: 28, margin: '20px 0 8px' }}>{title}</h1>
      <p style={{ color: '#65769180', fontSize: 12, marginBottom: 28 }}>Last updated: June 2026</p>
      <div style={{ color: '#c8d2e2', fontSize: 14.5 }}>{children}</div>
      <div style={{ marginTop: 40, padding: 16, background: 'rgba(186,117,23,.12)', border: '1px solid rgba(186,117,23,.3)', borderRadius: 10, color: '#efc275', fontSize: 12.5 }}>
        This is a starting template, not legal advice. Have a qualified lawyer in your jurisdiction review and adapt all legal pages before you take payment.
      </div>
    </main>
  );
}

export const legalStyles = {
  h2: { fontSize: 18, margin: '26px 0 10px', color: '#eef2f8' } as React.CSSProperties,
  p: { marginBottom: 12 } as React.CSSProperties,
  link: { color: '#85b7eb', textDecoration: 'underline' } as React.CSSProperties,
};
