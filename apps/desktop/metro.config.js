// Metro config for Expo + Tauri side-by-side dev.
//
// Two non-default tweaks:
//   1. blockList: ignore src-tauri/target so Cargo's mid-compile temp files
//      don't crash the file watcher (see memory/frontend_stack_workarounds.md).
//   2. watchFolders + nodeModulesPaths: teach Metro about the pnpm monorepo
//      so it can follow the @yt-subtitle-maker/ui workspace symlink and
//      resolve hoisted deps from the repo root.
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Tell Metro to ignore the entire Tauri build dir (Rust artifacts churn during compile).
config.resolver = config.resolver || {};
config.resolver.blockList = /[\\/]src-tauri[\\/]/;

// Watch the whole workspace so packages/ui changes are picked up live.
config.watchFolders = [workspaceRoot];

// Resolve modules from the app's node_modules first, then walk up to the
// hoisted root. Without this Metro misses workspace symlinks under pnpm.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
