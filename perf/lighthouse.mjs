/**
 * Run Lighthouse (desktop preset, performance only) N times against the
 * editor with the 210-block stress page and record the median of each metric.
 *
 *   PERF_LABEL=naive node perf/lighthouse.mjs [baseUrl]
 *
 * Uses `npx lighthouse`, so Lighthouse is downloaded on first use rather than
 * installed as a project dependency.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BASE = process.argv[2] ?? "http://localhost:3000";
const LABEL = process.env.PERF_LABEL ?? "current";
const RUNS = Number(process.env.PERF_RUNS ?? 3);
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const URL = `${BASE}/editor?template=stress`;

const dir = join(process.cwd(), "perf", "results");
mkdirSync(dir, { recursive: true });

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const runs = [];
for (let i = 0; i < RUNS; i++) {
  const out = join(process.cwd(), "perf", `lighthouse-${LABEL}-${i}.report.json`);
  execFileSync(
    "npx",
    [
      "--yes",
      "lighthouse@12",
      `"${URL}"`,
      "--preset=desktop",
      "--only-categories=performance",
      "--output=json",
      // shell: true (needed for npx on Windows) splits on spaces, so quote paths.
      `--output-path="${out}"`,
      "--quiet",
      "--chrome-flags=--headless=new",
    ],
    { stdio: "inherit", shell: true, env: { ...process.env, CHROME_PATH: CHROME } },
  );
  const lhr = JSON.parse(readFileSync(out, "utf8"));
  const a = lhr.audits;
  runs.push({
    score: Math.round(lhr.categories.performance.score * 100),
    fcpMs: Math.round(a["first-contentful-paint"].numericValue),
    lcpMs: Math.round(a["largest-contentful-paint"].numericValue),
    tbtMs: Math.round(a["total-blocking-time"].numericValue),
    cls: Math.round(a["cumulative-layout-shift"].numericValue * 1000) / 1000,
    speedIndexMs: Math.round(a["speed-index"].numericValue),
    totalJsKB: Math.round(
      (a["network-requests"].details.items.filter((r) => r.resourceType === "Script").reduce((t, r) => t + r.transferSize, 0) / 1024) * 10,
    ) / 10,
  });
}

const keys = Object.keys(runs[0]);
const report = {
  label: LABEL,
  date: new Date().toISOString(),
  url: URL,
  environment: "Lighthouse 12, desktop preset, headless Chrome, local production build",
  runs,
  median: Object.fromEntries(keys.map((k) => [k, median(runs.map((r) => r[k]))])),
};
writeFileSync(join(dir, `lighthouse-${LABEL}.json`), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report.median, null, 2));
