import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";
import { findMarkers, type Element } from "./tools/html.ts";

// In public/_headers, where the CSP's script-src takes the inline scripts' hashes.
const PLACEHOLDER = "{inline-script-hashes}";
const HEADERS_FILE = "_headers";

/** Scripts the browser runs; JSON and other data blocks aren't subject to the CSP. */
function isInlineScript(element: Element) {
  if (element.tagName !== "script") return false;
  const attributes = new Map(element.attrs.map((a) => [a.name, a.value]));
  const type = attributes.get("type")?.toLowerCase();
  return (
    !attributes.has("src") &&
    (!type || type === "module" || type.includes("javascript"))
  );
}

/** CSP source expressions for the inline scripts in `html`, as browsers hash them. */
function scriptHashes(html: string) {
  return findMarkers(html, isInlineScript).map(({ element }) => {
    const [text] = element.childNodes;
    const code = text && "value" in text ? text.value : "";
    const hash = crypto.createHash("sha256").update(code).digest("base64");
    return `'sha256-${hash}'`;
  });
}

/**
 * Finish Cloudflare's _headers file: after a build, put the hashes of the
 * pages' inline scripts into its Content-Security-Policy, since they change
 * with every build. `make preview` serves the build with these headers through
 * wrangler dev, so a policy that breaks the page shows up before deploying.
 * (The dev server injects scripts of its own, so it runs without them.)
 */
export function headersFile(): Plugin {
  let outDir = "";
  return {
    name: "headers-file",
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const file = path.join(outDir, HEADERS_FILE);
      const headers = fs.readFileSync(file, "utf8");
      if (headers.split(PLACEHOLDER).length !== 2)
        throw new Error(`${HEADERS_FILE} must contain ${PLACEHOLDER} once`);
      // One policy covers every page, so it allows each page's scripts.
      const pages = fs
        .readdirSync(outDir)
        .filter((name) => name.endsWith(".html"));
      const hashes = pages.flatMap((page) =>
        scriptHashes(fs.readFileSync(path.join(outDir, page), "utf8"))
      );
      fs.writeFileSync(file, headers.replace(PLACEHOLDER, hashes.join(" ")));
    }
  };
}
