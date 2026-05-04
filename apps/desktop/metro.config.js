// Metro config for Expo + Tauri side-by-side dev.
// Crucial: blockList src-tauri/target so Cargo's churn doesn't crash the watcher.
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Tell Metro to ignore the entire Tauri build dir (Rust artifacts churn during compile).
config.resolver = config.resolver || {};
config.resolver.blockList = /[\\/]src-tauri[\\/]/;

module.exports = config;
