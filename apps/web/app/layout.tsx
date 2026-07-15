import type { Metadata, Viewport } from 'next';
import { Archivo } from 'next/font/google';
import { Providers } from './providers';

// Weights match tamagui.config.ts's face map (400/600/800). display: 'swap'
// avoids blocking first paint on the font.
const archivo = Archivo({ subsets: ['latin'], weight: ['400', '600', '800'], display: 'swap' });

export const metadata: Metadata = {
  title: 'Algebra Tutor',
  description:
    'Self-paced Algebra 1 tutor with scaffolded lessons, Regents review, and adaptive practice (EN/ES).',
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

// Light/dark aware — browser chrome (address bar tint, PWA status bar) picks
// the color that matches the active scheme. The pre-hydration script below
// is the load-bearing piece for avoiding a light-to-dark flash on first paint.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f3f2f2' },
    { media: '(prefers-color-scheme: dark)', color: '#141313' },
  ],
};

/**
 * Runs before hydration to stamp data-theme on <html>. The CSS body
 * background reads from that attribute, so the page paints in the right
 * mode from the very first frame (no white-flash for a dark-mode user).
 * Reads the same 'tutor.theme.mode' key that
 * packages/app/src/lib/theme.tsx persists.
 */
const THEME_BOOT = `(function(){try{var m=localStorage.getItem('tutor.theme.mode');var d=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches;var r=(m==='light'||m==='dark')?m:(d?'dark':'light');document.documentElement.setAttribute('data-theme',r);}catch(_){document.documentElement.setAttribute('data-theme','light');}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={archivo.className}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body style={{ margin: 0 }}>
        {/* The document scrolls normally; the chrome holds its place with
            plain CSS so it works from the first paint, before hydration:
            sticky top bar, fixed bottom tabs (phone widths only — the JS
            hides them >=768px after hydration; the media query covers the
            server-rendered frame). Body background keys on data-theme so a
            dark-preference user never sees the light-mode surface flash. */}
        <style>{`
          /* Higher specificity than Tamagui's own body{background:var(--background)}
             which would otherwise win by cascade order. */
          html body{background:#f3f2f2}
          html[data-theme="dark"] body{background:#141313}
          #top-bar{position:sticky;top:0;z-index:40}
          #bottom-tabs{position:fixed;bottom:0;left:0;right:0;z-index:40}
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
