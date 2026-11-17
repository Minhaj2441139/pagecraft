/**
 * Real-browser measurements against a running production build
 * (`npm run build && npm start`). Requires a local Chrome.
 *
 *   PERF_LABEL=naive node perf/browser.mjs [baseUrl]
 *
 * 1. JavaScript loaded by the editor route (transfer + decoded bytes).
 * 2. Typing latency on the 210-block stress page, from the Event Timing API
 *    (the same data INP is built from): every keydown/keyup/input event's
 *    duration while typing 40 characters into a text field.
 * Writes perf/results/browser-<label>.json.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { chromium } from "playwright-core";

const BASE = process.argv[2] ?? "http://localhost:3000";
const LABEL = process.env.PERF_LABEL ?? "current";
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const RUNS = Number(process.env.PERF_RUNS ?? 3);
const CHARS = 40;

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const pct = (xs, p) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(xs.length * p))];

const browser = await chromium.launch({ executablePath: CHROME });

async function measureJs() {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${BASE}/editor?template=blank`, { waitUntil: "networkidle" });
  await page.getByRole("tree", { name: "Page canvas" }).waitFor();
  const scripts = await page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .filter((e) => e.initiatorType === "script" || e.name.endsWith(".js"))
      .map((e) => ({ name: e.name.split("/").pop(), transfer: e.transferSize, decoded: e.decodedBodySize })),
  );
  await context.close();
  return {
    files: scripts.length,
    transferKB: Math.round(scripts.reduce((a, s) => a + s.transfer, 0) / 102.4) / 10,
    decodedKB: Math.round(scripts.reduce((a, s) => a + s.decoded, 0) / 102.4) / 10,
  };
}

async function measureTyping() {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.addInitScript(() => {
    window.__eventDurations = [];
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        if (["keydown", "keyup", "keypress", "input", "beforeinput"].includes(e.name)) window.__eventDurations.push(e.duration);
      }
    }).observe({ type: "event", durationThreshold: 16, buffered: true });
  });
  await page.goto(`${BASE}/editor?template=stress`);
  await page.waitForURL(/id=/);
  const canvas = page.getByRole("tree", { name: "Page canvas" });
  await canvas.getByRole("treeitem").first().waitFor();
  await canvas.getByRole("treeitem", { name: /^Text/ }).first().click();
  const field = page.getByLabel("Text", { exact: true });
  await field.click();
  await page.keyboard.press("End");
  await page.waitForTimeout(300);
  await page.evaluate(() => (window.__eventDurations = []));

  const start = Date.now();
  for (let i = 0; i < CHARS; i++) await page.keyboard.type("x", { delay: 0 });
  const wallMs = Date.now() - start;
  await page.waitForTimeout(500);
  const durations = await page.evaluate(() => window.__eventDurations);
  await context.close();
  return { wallMs, slowEvents: durations.length, durations };
}

const js = await measureJs();
const typingRuns = [];
for (let r = 0; r < RUNS; r++) typingRuns.push(await measureTyping());
await browser.close();

const all = typingRuns.flatMap((r) => r.durations);
const report = {
  label: LABEL,
  date: new Date().toISOString(),
  environment: `Chrome (playwright-core), production build at ${BASE}`,
  editorJs: js,
  typing: {
    chars: CHARS,
    runs: RUNS,
    medianWallMsFor40Chars: median(typingRuns.map((r) => r.wallMs)),
    eventsOver16msPerRun: typingRuns.map((r) => r.slowEvents),
    // Event Timing durations are rounded to 8 ms by the browser.
    medianSlowEventMs: all.length ? median(all) : 0,
    p95SlowEventMs: all.length ? pct(all, 0.95) : 0,
    maxEventMs: all.length ? Math.max(...all) : 0,
  },
};

const dir = join(process.cwd(), "perf", "results");
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, `browser-${LABEL}.json`), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
