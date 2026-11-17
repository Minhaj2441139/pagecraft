/**
 * Opt-in render counter for the performance benchmarks. Does nothing unless a
 * benchmark installs `globalThis.__PC_RENDER_STATS__`, so the production cost
 * is a single property read per render.
 */
declare global {
  var __PC_RENDER_STATS__: Map<string, number> | undefined;
}

export function trackRender(component: string): void {
  const stats = globalThis.__PC_RENDER_STATS__;
  if (stats) stats.set(component, (stats.get(component) ?? 0) + 1);
}
