/**
 * Re-render benchmark: the real /editor route component (toolbar, palette,
 * canvas, panel, autosave, shortcuts) on the 210-block stress page, inside a
 * React <Profiler>. Only `next/navigation` is mocked, so the same file runs
 * unchanged against the naive and the optimized code.
 *
 *   PERF_LABEL=naive npm run perf
 *
 * Writes perf/results/jsdom-<label>.json. Durations are React Profiler
 * `actualDuration` in development mode under jsdom: compare them with each
 * other, not with real-browser numbers.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { act, render, screen } from "@testing-library/react";
import { Profiler, type ProfilerOnRenderCallback } from "react";
import { expect, it, vi } from "vitest";

import { buildStressDocument } from "@/blocks/templates";
import EditorRoute from "@/components/editor/EditorRoute";
import { savePage } from "@/lib/storage";
import { EditorStoreProvider } from "@/store/context";
import { createEditorStore } from "@/store/editor";

const doc = buildStressDocument();

// Stable references, like the real Next.js hooks (EditorRoute's effect depends on them).
const router = { replace: () => undefined, push: () => undefined };
const searchParams = new URLSearchParams({ id: doc.id });
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useSearchParams: () => searchParams,
}));

const ITERATIONS = 40;
const LABEL = process.env.PERF_LABEL ?? "current";

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

const round = (n: number) => Math.round(n * 100) / 100;

it("measures re-renders on a 210-block page", async () => {
  const store = createEditorStore();
  savePage(doc);
  const blockCount = Object.keys(doc.blocks).length;

  let commitDurations: number[] = [];
  const onRender: ProfilerOnRenderCallback = (_id, _phase, actualDuration) => {
    commitDurations.push(actualDuration);
  };

  const mountStart = performance.now();
  render(
    <Profiler id="editor" onRender={onRender}>
      <EditorStoreProvider store={store}>
        <EditorRoute />
      </EditorStoreProvider>
    </Profiler>,
  );
  await screen.findAllByRole("treeitem", {}, { timeout: 10_000 });
  const mountMs = performance.now() - mountStart;
  const mountProfilerMs = commitDurations.reduce((a, b) => a + b, 0);
  // Let lazy chunks (palette) settle so they are not counted as per-update work.
  await screen.findByRole("button", { name: "Add Text block" }, { timeout: 10_000 });

  const textIds = Object.values(doc.blocks)
    .filter((b) => b.type === "text")
    .map((b) => b.id);
  const target = textIds[0]!;
  const other = textIds[textIds.length - 1]!;

  async function scenario(name: string, step: (i: number) => void) {
    const perIteration: Array<Map<string, number>> = [];
    const durations: number[] = [];
    for (let i = 0; i < ITERATIONS; i++) {
      const stats = new Map<string, number>();
      globalThis.__PC_RENDER_STATS__ = stats;
      commitDurations = [];
      await act(async () => step(i));
      durations.push(commitDurations.reduce((a, b) => a + b, 0));
      perIteration.push(stats);
    }
    globalThis.__PC_RENDER_STATS__ = undefined;
    // Iterations where a component did not render count as 0.
    const components = [...new Set(perIteration.flatMap((m) => [...m.keys()]))];
    return {
      name,
      medianCommitMs: round(median(durations)),
      p95CommitMs: round([...durations].sort((a, b) => a - b)[Math.floor(durations.length * 0.95)]!),
      medianRendersPerUpdate: Object.fromEntries(components.map((c) => [c, median(perIteration.map((m) => m.get(c) ?? 0))])),
      totalRenders: Object.fromEntries(components.map((c) => [c, perIteration.reduce((t, m) => t + (m.get(c) ?? 0), 0)])),
    };
  }

  act(() => store.getState().select(target));

  const results = [
    await scenario("type one character into a text block", (i) =>
      store.getState().updateProps(target, { text: `Edited ${"x".repeat(i + 1)}` }, { coalesceKey: "bench" }),
    ),
    await scenario("change selection", (i) => store.getState().select(i % 2 ? target : other)),
    await scenario("drag-over indicator moves to another block", (i) =>
      store.getState().setDropIndicator({ overId: textIds[i % textIds.length]!, position: i % 2 ? "after" : "before" }),
    ),
    await scenario("change a style value", (i) => store.getState().updateStyle(target, { paddingY: i }, { coalesceKey: "bench-style" })),
  ];

  const report = {
    label: LABEL,
    date: new Date().toISOString(),
    environment: "vitest + jsdom, React development build",
    blockCount,
    iterations: ITERATIONS,
    mount: { wallMs: round(mountMs), profilerMs: round(mountProfilerMs) },
    scenarios: results,
  };

  const dir = join(process.cwd(), "perf", "results");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `jsdom-${LABEL}.json`), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  expect(blockCount).toBeGreaterThanOrEqual(200);
}, 120_000);
