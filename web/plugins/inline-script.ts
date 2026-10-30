import path from "node:path";
import { rolldown } from "rolldown";
import type { Plugin } from "vite";
import {
  assertEmpty,
  type Element,
  findMarkers,
  readAttributes,
  replaceMarkers
} from "./tools/html.ts";

// <script type="inline" src="src/head.ts"></script>
// A script element is valid anywhere in <head>, and browsers never run an
// unknown type, so the marker is harmless even if this plugin didn't run.
const TYPE = "inline";

/**
 * Bundle `file` and its imports into one minified classic script. `alias` maps
 * import prefixes to paths, as in the Vite config.
 */
async function bundle(file: string, alias: Record<string, string>) {
  const build = await rolldown({ input: file, resolve: { alias } });
  try {
    const { output } = await build.generate({ format: "iife", minify: true });
    const [chunk] = output;
    return { code: chunk.code.trim(), modules: chunk.moduleIds };
  } finally {
    await build.close();
  }
}

const isMarker = (element: Element) =>
  element.tagName === "script" &&
  element.attrs.some(({ name, value }) => name === "type" && value === TYPE);

/**
 * Replace `<script type="inline" src="…">` in index.html with the named module
 * (relative to the Vite root), bundled into an inline classic <script>. For
 * code that must run before first paint without waiting on a request.
 */
export function inlineScript(): Plugin {
  let root = "";
  // Rolldown runs outside Vite, so it needs the config's aliases, such as @/.
  let alias: Record<string, string> = {};
  const watched = new Set<string>();
  return {
    name: "inline-script",
    configResolved(config) {
      root = config.root;
      // Vite adds pattern aliases of its own; the config's are plain prefixes.
      alias = Object.fromEntries(
        config.resolve.alias
          .filter(({ find }) => typeof find === "string")
          .map(({ find, replacement }) => [find, replacement])
      );
    },
    transformIndexHtml: {
      // Before Vite's own HTML step, which would warn about a script it can't bundle.
      order: "pre",
      handler(html) {
        const markers = findMarkers(html, isMarker);
        return replaceMarkers(html, markers, async ({ element }) => {
          assertEmpty(element);
          const { src } = readAttributes(element, ["type", "src"]);
          const { code, modules } = await bundle(
            path.resolve(root, src),
            alias
          );
          modules.forEach((module) => watched.add(module));
          // A "</script" inside the code would end the element early.
          return `<script>${code.replaceAll("</script", "<\\/script")}</script>`;
        });
      }
    },
    configureServer(server) {
      // The page doesn't import these modules, so Vite won't reload for them.
      server.watcher.on("change", (file) => {
        if (watched.has(file)) server.ws.send({ type: "full-reload" });
      });
    }
  };
}
