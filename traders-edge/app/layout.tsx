import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: "Trader's Edge — The Discipline Engine for Prop Firm Traders",
  description:
    'Define your edge, score every setup against your own confluence model, and let AI read your charts before you enter. Built for SMC and prop firm traders.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* Source Serif 4 for display headings, Inter for body, JetBrains Mono for code/values.
            Same stack as the validated prototype design. */}
        <link
          href="https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,400;8..60,500;8..60,600;8..60,700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
