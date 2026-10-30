import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";
import {
  assertEmpty,
  findMarkers,
  readAttributes,
  replaceMarkers
} from "./tools/html.ts";

// <html-include src="src/plain/plain.html"></html-include>
const TAG = "html-include";

/**
 * Replace `<html-include src="…">` elements in index.html with the named HTML
 * fragment (relative to the Vite root), so a part of the page can live next to
 * its code. Fragments may include others. Runs before the other HTML plugins,
 * so their markers work inside fragments too.
 */
export function htmlInclude(): Plugin {
  let root = "";
  const watched = new Set<string>();

  async function expand(html: string, stack: string[]): Promise<string> {
    const markers = findMarkers(html, (element) => element.tagName === TAG);
    return replaceMarkers(html, markers, ({ element }) => {
      assertEmpty(element);
      const { src } = readAttributes(element, ["src"]);
      const file = path.resolve(root, src);
      if (!fs.existsSync(file))
        throw new Error(`<${TAG}> src="${src}" is not a file in ${root}`);
      if (stack.includes(file))
        throw new Error(`<${TAG}> src="${src}" includes itself`);
      watched.add(file);
      return expand(fs.readFileSync(file, "utf8").trim(), [...stack, file]);
    });
  }

  return {
    name: "html-include",
    configResolved(config) {
      root = config.root;
    },
    transformIndexHtml: {
      order: "pre",
      handler: (html) => expand(html, [])
    },
    configureServer(server) {
      // The page doesn't import fragments, so Vite won't reload for them.
      server.watcher.on("change", (file) => {
        if (watched.has(file)) server.ws.send({ type: "full-reload" });
      });
    }
  };
}
