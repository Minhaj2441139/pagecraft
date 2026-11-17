import { resolve } from "node:path";
import { defineConfig } from "vite";

// Library build: `npm run build:export` emits a standalone ESM bundle in dist/.
// Inside the monorepo the Next app consumes the TypeScript source directly.
export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      formats: ["es"],
      fileName: "index",
    },
    sourcemap: true,
  },
});
