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
      <body>{children}</body>
    </html>
  );
}
