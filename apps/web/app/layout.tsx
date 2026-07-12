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
        {/* Pin the app chrome to the viewport so the top bar and bottom
            tabs stay fixed and only the content between them scrolls.
            dvh tracks mobile browser toolbars; vh is the fallback. */}
        <style>{`#app-shell{height:100vh;height:100dvh}`}</style>
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
