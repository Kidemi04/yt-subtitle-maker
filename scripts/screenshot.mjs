// Take a screenshot of the running Expo web dev server.
// Usage: node scripts/screenshot.mjs <url> <output.png> [width] [height] [waitForText]
import { chromium } from "playwright";

const url = process.argv[2] || "http://localhost:8081";
const out = process.argv[3] || "docs/superpowers/design-handoff/screenshots/screen.png";
const width = parseInt(process.argv[4] || "1440", 10);
const height = parseInt(process.argv[5] || "900", 10);
const waitForText = process.argv[6]; // optional substring to wait for

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width, height },
  deviceScaleFactor: 1,
});
const page = await context.newPage();

// Surface browser-console messages so we can debug white-screen issues
page.on("console", (msg) => {
  const t = msg.type();
  if (t === "error" || t === "warning") {
    console.log(`[browser ${t}]`, msg.text());
  }
});
page.on("pageerror", (err) => {
  console.log("[browser pageerror]", err.message);
});

console.log(`Loading ${url}...`);
await page.goto(url, { waitUntil: "networkidle", timeout: 90000 });

if (waitForText) {
  console.log(`Waiting for text "${waitForText}"...`);
  try {
    await page.waitForSelector(`text=${waitForText}`, { timeout: 60000 });
    console.log("Text appeared");
  } catch (e) {
    console.log(`!! Text never appeared: ${e.message}`);
  }
} else {
  // Generic wait for any non-empty body
  await page.waitForFunction(() => document.body.innerText.trim().length > 0, { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(3000);
}

await page.screenshot({ path: out, fullPage: false });
console.log(`Saved ${out} (${width}x${height})`);

await browser.close();
