import fs from "node:fs";
import path from "node:path";
import { Marked } from "marked";
import type { Plugin } from "vite";
import {
  assertEmpty,
  findMarkers,
  readAttributes,
  replaceMarkers
} from "./tools/html.ts";

// <markdown-include src="links.md" heading-offset="1"></markdown-include>
const TAG = "markdown-include";

const escapeHtml = (text: string) =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

// The Markdown is text: HTML in it shows as written instead of becoming markup.
const marked = new Marked({
  renderer: { html: ({ text }) => escapeHtml(text) }
});

function render(file: string, headingOffset: number): string {
  const tokens = marked.lexer(fs.readFileSync(file, "utf8"));
  marked.walkTokens(tokens, (token) => {
    if (token.type === "heading") token.depth += headingOffset;
  });
  // GFM autolinks turn bare URLs and email addresses into links.
  return marked.parser(tokens);
}

/**
 * Replace `<markdown-include src="…">` elements in index.html with the named
 * Markdown file from `dir`, rendered to HTML. `heading-offset` demotes its
 * headings, so a file's `#` title can become an `<h2>` on the page.
 */
export function markdownInclude(dir: string): Plugin {
  return {
    name: "markdown-include",
    transformIndexHtml(html) {
      const markers = findMarkers(html, (element) => element.tagName === TAG);
      return replaceMarkers(html, markers, ({ element }) => {
        assertEmpty(element);
        const { src, "heading-offset": offset = "0" } = readAttributes(
          element,
          ["src"],
          ["heading-offset"]
        );
        const headingOffset = Number(offset);
        if (!Number.isInteger(headingOffset) || headingOffset < 0)
          throw new Error(`<${TAG}> heading-offset must be a whole number`);
        const file = path.join(dir, src);
        if (!fs.existsSync(file))
          throw new Error(`<${TAG}> src="${src}" is not a file in ${dir}`);
        return render(file, headingOffset);
      });
    },
    configureServer(server) {
      server.watcher.add(dir);
      server.watcher.on("change", (file) => {
        if (file.startsWith(dir)) server.ws.send({ type: "full-reload" });
      });
    }
  };
}
