import type { Metadata, Viewport } from 'next';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'Algebra Tutor',
  description:
    'Self-paced Algebra 1 tutor with scaffolded lessons, exit tickets, and adaptive practice (EN/ES).',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/icon.svg',
    apple: '/icon-180.png',
  },
  appleWebApp: {
    capable: true,
    title: 'Algebra',
    statusBarStyle: 'black-translucent',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#3b5bdb',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body style={{ margin: 0, background: '#f6f7fb' }}>
        {/* The document scrolls normally; the chrome holds its place with
            plain CSS so it works from the first paint, before hydration:
            sticky top bar, fixed bottom tabs (phone widths only — the JS
            hides them >=768px after hydration; the media query covers the
            server-rendered frame), fixed reference-sheet button. */}
        <style>{`
          #top-bar{position:sticky;top:0;z-index:40}
          #bottom-tabs{position:fixed;bottom:0;left:0;right:0;z-index:40}
          #ref-sheet-btn{position:fixed !important}
          @media (min-width:768px){#bottom-tabs{display:none}}
        `}</style>
        <Providers>{children}</Providers>
        <script
          dangerouslySetInnerHTML={{
            __html: `if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'));
}`,
          }}
        />
      </body>
    </html>
  );
}
