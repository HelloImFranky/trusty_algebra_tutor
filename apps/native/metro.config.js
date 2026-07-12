// Expo metro config, monorepo-aware: watch the workspace root so changes in
// packages/* hot-reload, and resolve modules from both node_modules trees.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// @tutor/core uses ESM-style relative imports with .js extensions (Node16
// resolution); map them back to the .ts/.tsx sources for metro.
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = defaultResolveRequest ?? context.resolveRequest;
  if (/^\.\.?\//.test(moduleName) && moduleName.endsWith('.js')) {
    for (const ext of ['.ts', '.tsx', '.js']) {
      try {
        return resolve(context, moduleName.slice(0, -3) + ext, platform);
      } catch {
        /* try the next extension */
      }
    }
  }
  return resolve(context, moduleName, platform);
};

module.exports = config;
