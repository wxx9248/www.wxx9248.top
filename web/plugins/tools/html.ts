// Helpers for plugins that replace marker elements in index.html. Parsing with
// parse5 (the parser Vite uses) instead of regexes gives exact element
// boundaries and properly parsed attributes.

import { parse, type DefaultTreeAdapterMap } from "parse5";

export type Element = DefaultTreeAdapterMap["element"];
type Node = DefaultTreeAdapterMap["node"];

/** A marker element and where it sits in the source HTML. */
export interface Marker {
  element: Element;
  start: number;
  end: number;
}

/** Find the elements written in `html` (not ones the parser implied) that pass `test`. */
export function findMarkers(
  html: string,
  test: (element: Element) => boolean
): Marker[] {
  const markers: Marker[] = [];
  const visit = (node: Node) => {
    if ("tagName" in node && node.sourceCodeLocation && test(node)) {
      const { startOffset, endOffset } = node.sourceCodeLocation;
      markers.push({ element: node, start: startOffset, end: endOffset });
    }
    if ("childNodes" in node) node.childNodes.forEach(visit);
    if ("content" in node) visit(node.content);
  };
  visit(parse(html, { sourceCodeLocationInfo: true }));
  return markers;
}

/** Replace each marker in `html` with what `render` returns for it. */
export async function replaceMarkers<M extends Marker>(
  html: string,
  markers: M[],
  render: (marker: M) => string | Promise<string>
): Promise<string> {
  const replacements = await Promise.all(markers.map(render));
  // From the end, so the offsets of earlier markers stay valid.
  for (let i = markers.length - 1; i >= 0; i--) {
    const { start, end } = markers[i];
    html = html.slice(0, start) + replacements[i] + html.slice(end);
  }
  return html;
}

/**
 * Read a marker's attributes, failing the build on a missing required one or
 * an unknown one (most likely a typo).
 */
export function readAttributes<R extends string, O extends string>(
  element: Element,
  required: readonly R[],
  optional: readonly O[] = []
): Record<R, string> & Partial<Record<O, string>> {
  const known: readonly string[] = [...required, ...optional];
  const tag = `<${element.tagName}>`;
  const attributes = Object.fromEntries(
    element.attrs.map(({ name, value }) => [name, value])
  );
  for (const name of Object.keys(attributes))
    if (!known.includes(name))
      throw new Error(
        `${tag} has an unknown attribute "${name}"; expected ${known.join(", ")}`
      );
  for (const name of required)
    if (!(name in attributes))
      throw new Error(`${tag} needs a "${name}" attribute`);
  return attributes as Record<R, string> & Partial<Record<O, string>>;
}

/** Markers are placeholders; content inside one would be silently lost. */
export function assertEmpty(element: Element) {
  if (element.childNodes.length > 0)
    throw new Error(`<${element.tagName}> must be empty`);
}
