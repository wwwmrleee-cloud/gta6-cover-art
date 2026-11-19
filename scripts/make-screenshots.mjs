// Generates screenshots/ from the app itself: serves app/ with
// `node serve.ts --port 8091`, then for each shot in shots.json opens the
// `?shot=` URL, waits for window.__shotReady, and:
//   (a) cover shots: clicks the REAL Export button in the page, captures the
//       downloaded PNG the app wrote, and scales it to the shot's target
//       size with PIL (scripts/scale-shot.py) — the screenshot is the app's
//       own exported PNG, scaled down only;
//   (b) the editor shot: takes a page screenshot.
// Writes JPEGs into screenshots/. Run from the repo root:
//   NODE_PATH=/home/hatch/workspace/makefun/pwtest/node_modules node scripts/make-screenshots.mjs
// (Playwright is installed under pwtest, not in this repo.)
import { spawn, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..');
const PORT = 8091;
const shots = JSON.parse(readFileSync(join(repo, 'shots.json'), 'utf8'));

function scaleShot(src, dst, w, h) {
  // Try quality 88 down to 75 until the JPEG fits the 256 KiB cap.
  for (const q of [88, 84, 80, 76, 75]) {
    execFileSync('python3', [join(here, 'scale-shot.py'), src, dst, String(w), String(h), String(q)], { stdio: 'inherit' });
    if (statSync(dst).size <= 262144) return q;
  }
  throw new Error(`${dst} still over 256 KiB at quality 75`);
}

async function waitForServer(url, tries = 40) {
  for (let i = 0; i < tries; i += 1) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`server did not come up at ${url}`);
}

const server = spawn('node', ['serve.ts', '--port', String(PORT)], { cwd: repo, stdio: 'inherit' });
const tmp = mkdtempSync(join(tmpdir(), 'vice-cover-shots-'));
try {
  await waitForServer(`http://127.0.0.1:${PORT}/`);
  const browser = await chromium.launch({
    executablePath: '/home/hatch/.cache/ms-playwright/chromium-1148/chrome-linux/chrome',
    args: ['--no-sandbox'],
  });
  try {
    for (const shot of shots) {
      const query = new URLSearchParams(shot.query.replace(/^\?/, ''));
      const isCover = query.get('shot') === 'cover';
      const sizeParam = query.get('size');
      let viewport = { width: shot.w, height: shot.h };
      if (isCover && sizeParam) {
        const [vw, vh] = sizeParam.split('x').map(Number);
        viewport = { width: vw, height: vh };
      }
      const context = await browser.newContext({
        viewport,
        acceptDownloads: true,
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
      page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
      await page.goto(`http://127.0.0.1:${PORT}/${shot.query}`, { waitUntil: 'load' });
      await page.waitForFunction(() => window.__shotReady, null, { timeout: 30000 });
      const out = join(repo, 'screenshots', shot.name);
      if (isCover) {
        // Click the REAL export button for this size and capture the download.
        const [w, h] = sizeParam.split('x').map(Number);
        const buttonId = `export-${w}x${h}`;
        const tmpPng = join(tmp, `${shot.name}.png`);
        const [download] = await Promise.all([
          page.waitForEvent('download', { timeout: 20000 }),
          page.evaluate((id) => document.getElementById(id).click(), buttonId),
        ]);
        await download.saveAs(tmpPng);
        const q = scaleShot(tmpPng, out, shot.w, shot.h);
        console.log(shot.name, 'cover PNG', `${w}x${h}`, '-> JPEG', `${shot.w}x${shot.h}`, `q${q}`, `${statSync(out).size} bytes`);
      } else {
        const tmpPng = join(tmp, `${shot.name}.png`);
        await page.screenshot({ path: tmpPng, type: 'png' });
        const q = scaleShot(tmpPng, out, shot.w, shot.h);
        console.log(shot.name, 'editor page -> JPEG', `${shot.w}x${shot.h}`, `q${q}`, `${statSync(out).size} bytes`);
      }
      if (errors.length) console.log('  WARNING errors on page:', errors.join(' | '));
      await context.close();
    }
  } finally {
    await browser.close();
  }
} finally {
  server.kill();
  rmSync(tmp, { recursive: true, force: true });
}
console.log('done');
