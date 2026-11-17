import { fileURLToPath } from "node:url";

import { defineConfig } from "vite";

const src = (file: string) => fileURLToPath(new URL(`./src/${file}`, import.meta.url));

// Library build: `npm run build:export` emits ESM bundles (index + html) in dist/.
// Inside the monorepo the Next app consumes the TypeScript source directly.
export default defineConfig({
  build: {
    lib: {
      entry: { index: src("index.ts"), html: src("html.ts") },
      formats: ["es"],
    },
    sourcemap: true,
  },
});
