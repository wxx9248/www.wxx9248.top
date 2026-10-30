import path from "node:path";
import { defineConfig } from "vite";
import { headersFile } from "./plugins/headers-file.ts";
import { htmlAlias } from "./plugins/html-alias.ts";
import { htmlInclude } from "./plugins/html-include.ts";
import { inlineScript } from "./plugins/inline-script.ts";
import { markdownInclude } from "./plugins/markdown-include.ts";
import { mountDirs } from "./plugins/mount-dirs.ts";
import { snapshotManifest } from "./plugins/snapshot-manifest.ts";
import tsconfig from "./tsconfig.json" with { type: "json" };
import {
  FONT_LICENSES_URL,
  KEYS_URL,
  SNAPSHOT_MANIFEST_ID,
  VM_FLAT_URL,
  VM_STATE_URL
} from "./src/site.ts";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC = path.join(import.meta.dirname, "src");
const BUILD = path.join(ROOT, "build");
// Public files: shipped in the VM as /wxx9248 and rendered into the plain page.
const CONTENT = path.join(ROOT, "image/overlay/wxx9248");
// What Cloudflare serves for paths that have no file (see wrangler.jsonc).
const NOT_FOUND_PAGE = "404.html";

export default defineConfig({
  root: import.meta.dirname,
  // In the dev server, unknown paths are a 404, not the homepage (Vite's
  // default, "spa").
  appType: "mpa",
  resolve: {
    // @/ is web/src (also in tsconfig.json); @build/ is the build output.
    alias: { "@": SRC, "@build": BUILD }
  },
  plugins: [
    // Files that live outside web/: the 9p files, snapshot parts, public keys
    // and font licences.
    mountDirs({
      [VM_FLAT_URL]: path.join(BUILD, "image/flat"),
      [VM_STATE_URL]: path.join(BUILD, "state/parts"),
      [KEYS_URL]: path.join(CONTENT, "keys"),
      [FONT_LICENSES_URL]: path.join(BUILD, "fonts/licenses")
    }),
    snapshotManifest(
      path.join(BUILD, "state/manifest.json"),
      SNAPSHOT_MANIFEST_ID
    ),
    // First, so the other plugins see the markers inside included fragments.
    htmlInclude(),
    htmlAlias(),
    markdownInclude(CONTENT),
    inlineScript(),
    headersFile()
  ],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    // The language version tsc checks against. Vite reads it from tsconfig.json
    // too, to compile class fields the same way.
    target: tsconfig.compilerOptions.target,
    rolldownOptions: {
      input: [
        path.join(import.meta.dirname, "index.html"),
        path.join(import.meta.dirname, NOT_FOUND_PAGE)
      ]
    }
  }
});
