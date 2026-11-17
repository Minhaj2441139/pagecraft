/**
 * Re-render benchmark: 210-block stress page, full editor (palette, canvas,
 * properties panel) inside a React <Profiler>.
 *
 *   PERF_LABEL=naive npm run perf
 *
 * Writes perf/results/jsdom-<label>.json. Durations are React Profiler
 * `actualDuration` in development mode under jsdom: compare them with each
 * other, not with real-browser numbers.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { act, render } from "@testing-library/react";
import { Profiler, type ProfilerOnRenderCallback } from "react";
import { expect, it } from "vitest";

import { buildStressDocument } from "@/blocks/templates";
import Editor from "@/components/editor/Editor";
import PropertiesPanel from "@/components/editor/PropertiesPanel";
import { EditorStoreProvider } from "@/store/context";
import { createEditorStore } from "@/store/editor";

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
  const doc = buildStressDocument();
  store.getState().loadDocument(doc);
  const blockCount = Object.keys(doc.blocks).length;

  let commitDurations: number[] = [];
  const onRender: ProfilerOnRenderCallback = (_id, _phase, actualDuration) => {
    commitDurations.push(actualDuration);
  };

  const mountStart = performance.now();
  render(
    <Profiler id="editor" onRender={onRender}>
      <EditorStoreProvider store={store}>
        <Editor panel={<PropertiesPanel />} />
      </EditorStoreProvider>
    </Profiler>,
  );
  const mountMs = performance.now() - mountStart;
  const mountProfilerMs = commitDurations.reduce((a, b) => a + b, 0);

  const textIds = Object.values(doc.blocks)
    .filter((b) => b.type === "text")
    .map((b) => b.id);
  const target = textIds[0]!;
  const other = textIds[textIds.length - 1]!;

  async function scenario(name: string, step: (i: number) => void) {
    const renders: Record<string, number[]> = {};
    const durations: number[] = [];
    for (let i = 0; i < ITERATIONS; i++) {
      globalThis.__PC_RENDER_STATS__ = new Map();
      commitDurations = [];
      await act(async () => step(i));
      durations.push(commitDurations.reduce((a, b) => a + b, 0));
      for (const [component, count] of globalThis.__PC_RENDER_STATS__) {
        (renders[component] ??= []).push(count);
      }
    }
    globalThis.__PC_RENDER_STATS__ = undefined;
    return {
      name,
      medianCommitMs: round(median(durations)),
      p95CommitMs: round([...durations].sort((a, b) => a - b)[Math.floor(durations.length * 0.95)]!),
      rendersPerUpdate: Object.fromEntries(Object.entries(renders).map(([c, counts]) => [c, median(counts)])),
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
