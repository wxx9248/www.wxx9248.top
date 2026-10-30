import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";

/** The page that boots the machine; other pages, such as 404.html, don't. */
const MACHINE_PAGE = "index.html";

/**
 * Inline the snapshot manifest written by tools/build-state.mjs as a JSON
 * script with element ID `id`, so the page knows which parts to fetch without
 * another round trip. src/head.ts preloads them and
 * src/machine/vm/snapshot.ts downloads them.
 */
export function snapshotManifest(file: string, id: string): Plugin {
  return {
    name: "snapshot-manifest",
    transformIndexHtml(_html, { filename }) {
      if (path.basename(filename) !== MACHINE_PAGE) return;
      return [
        {
          tag: "script",
          attrs: { type: "application/json", id },
          // JSON allows \u003c for <, so the text can't contain </script>.
          children: fs
            .readFileSync(file, "utf8")
            .trim()
            .replaceAll("<", "\\u003c"),
          injectTo: "head-prepend"
        }
      ];
    }
  };
}
