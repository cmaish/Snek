// Regenerates public/icons/*.png from tools/icon.html.
// Usage (from the repo root):  python3 -m http.server 8123 &  node tools/make-icons.mjs
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)('playwright');
const base = process.env.BASE || 'http://localhost:8123';
const out = new URL('../public/icons/', import.meta.url).pathname;
const jobs = [
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['icon-maskable-512.png', 512, true],
  ['apple-touch-icon.png', 180, true],
];
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, size, maskable] of jobs) {
  await page.setViewportSize({ width: size, height: size });
  await page.goto(`${base}/tools/icon.html?size=${size}&maskable=${maskable ? 1 : 0}`);
  await page.waitForFunction(() => document.title === 'done');
  await page.locator('#c').screenshot({ path: out + name, omitBackground: true });
  console.log('wrote', name);
}
await browser.close();
