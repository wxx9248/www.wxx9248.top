import path from "node:path";
import type { Plugin } from "vite";
import { findMarkers, type Marker, replaceMarkers } from "./tools/html.ts";

// <link rel="preload" href="@build/fonts/DepartureMono-Regular.woff2" …>
const ATTRIBUTES = ["href", "src"];

/**
 * Resolve the config's aliases, such as @build/, in HTML href and src
 * attributes, as Vite already does in CSS and scripts. A build gets a path
 * relative to the Vite root, which Vite then fingerprints like any other
 * asset; the dev server gets Vite's /@fs/ URL for the file.
 */
export function htmlAlias(): Plugin {
  // Alias prefix ("@build/") to what replaces it.
  let prefixes: [string, string][] = [];
  return {
    name: "html-alias",
    configResolved(config) {
      prefixes = config.resolve.alias
        .filter(({ find }) => typeof find === "string")
        .map(({ find, replacement }) => [
          `${find}/`,
          config.command === "build"
            ? `${path.relative(config.root, replacement)}/`
            : `/@fs${replacement}/`
        ]);
    },
    transformIndexHtml: {
      // Before Vite's own HTML step, which fingerprints what the URLs name.
      order: "pre",
      handler(html) {
        // One marker per aliased attribute, spanning just that attribute.
        const markers: (Marker & { name: string; value: string })[] = [];
        findMarkers(html, () => true).forEach(({ element }) => {
          for (const { name, value } of element.attrs) {
            const location = element.sourceCodeLocation?.attrs?.[name];
            if (!ATTRIBUTES.includes(name) || !location) continue;
            const [prefix, replacement] =
              prefixes.find(([prefix]) => value.startsWith(prefix)) ?? [];
            if (prefix === undefined) continue;
            markers.push({
              element,
              start: location.startOffset,
              end: location.endOffset,
              name,
              value: replacement + value.slice(prefix.length)
            });
          }
        });
        markers.sort((a, b) => a.start - b.start);
        return replaceMarkers(
          html,
          markers,
          ({ name, value }) => `${name}="${value.replaceAll('"', "&quot;")}"`
        );
      }
    }
  };
}
