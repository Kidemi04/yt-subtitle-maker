// App entry point.
//
// This just re-exports `expo-router/entry`, but it MUST live inside this
// project so the bundled entry module resolves to a path *under* the project
// root. In this pnpm monorepo `.npmrc` sets `node-linker=hoisted`, so
// `expo-router` lives at <repo-root>/node_modules — if `package.json`'s
// `main` points straight at `expo-router/entry`, Expo's web HTML emits
// `<script src="/../../node_modules/expo-router/entry.bundle">`; browsers
// normalize the `../../` away, the resulting URL 404s, no JS runs, and you
// get a blank white window. With `main` pointed here the script src becomes
// `/index.bundle` and everything loads. See https://docs.expo.dev/guides/monorepos/
import "expo-router/entry";
