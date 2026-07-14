import path from 'node:path';
import url from 'node:url';

const here = path.dirname(url.fileURLToPath(import.meta.url));

/**
 * Tamagui/react-native-web wiring done by hand (runtime styling only — no
 * optimizing compiler), which keeps us independent of @tamagui/next-plugin's
 * webpack version constraints.
 */
/** @type {import('next').NextConfig} */
const config = {
  outputFileTracingRoot: path.join(here, '../..'),
  // make sure Prisma's native query engine ships in the traced server output
  // (Vercel packs serverless functions from this same file trace)
  outputFileTracingIncludes: {
    '*': ['../../node_modules/.prisma/client/**'],
  },
  transpilePackages: [
    'react-native',
    'react-native-web',
    'solito',
    'tamagui',
    '@tutor/app',
    '@tutor/api',
    '@tutor/core',
    '@tutor/db',
  ],
  env: {
    TAMAGUI_TARGET: 'web',
  },
  // Baseline security headers. These reduce the blast radius of any XSS
  // (auth tokens live in web storage) and stop MIME/clickjacking tricks. A
  // full Content-Security-Policy is intentionally omitted here: Tamagui/RN-web
  // inject inline <style>/<script>, so a strict CSP needs nonce plumbing —
  // tracked as follow-up.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },
  webpack: (webpackConfig) => {
    webpackConfig.resolve.alias = {
      ...webpackConfig.resolve.alias,
      'react-native$': 'react-native-web',
    };
    // our TS packages import with ESM ".js" specifiers — map them back to .ts
    webpackConfig.resolve.extensionAlias = {
      ...webpackConfig.resolve.extensionAlias,
      '.js': ['.ts', '.tsx', '.js'],
      '.jsx': ['.tsx', '.jsx'],
    };
    // prefer platform-specific files (Katex.web.tsx over Katex.tsx)
    webpackConfig.resolve.extensions = [
      '.web.tsx',
      '.web.ts',
      '.web.jsx',
      '.web.js',
      ...webpackConfig.resolve.extensions,
    ];
    return webpackConfig;
  },
};

export default config;
