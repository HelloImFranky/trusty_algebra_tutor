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
