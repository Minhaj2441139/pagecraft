import { defineConfig } from "vitest/config";

import base from "./vitest.config";

/** Benchmarks live outside the unit suite: `npm run perf`. */
export default defineConfig({
  ...base,
  test: {
    ...base.test,
    include: ["perf/**/*.perf.tsx"],
    coverage: { enabled: false },
  },
});
