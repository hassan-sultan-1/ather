import type { Metadata, Viewport } from 'next';
import './globals.css';
import Nav from '@/components/Nav';

export const metadata: Metadata = {
  title: 'AETHER — Latent Dream Engine',
  description:
    'AETHER folds any sentence into a 48-dimensional latent vector and decodes it into a living field of light, a palette, a poem and a sigil. Deterministic, offline, and never twice the same.',
  applicationName: 'AETHER',
  authors: [{ name: 'AETHER' }],
  openGraph: {
    title: 'AETHER — Latent Dream Engine',
    description: 'Type a dream. Watch it render. It will never exist again.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#06070b',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="grain" aria-hidden="true" />
        <Nav />
        {children}
      </body>
    </html>
  );
}
