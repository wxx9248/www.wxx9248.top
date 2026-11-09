#!/usr/bin/env node
// The site's colours are the semantic tokens of @wxx9248/colors. A few static
// files can't import them and repeat them instead; `check` fails when one of
// those copies has drifted.
//
//   node web/colors.mjs get <token>   print one as #rrggbb, e.g. bg-page
//   node web/colors.mjs check         compare the copies with the tokens

import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import zlib from "node:zlib";
import { resolve, semanticTokens } from "@wxx9248/colors";

const ROOT = path.join(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const PAGES = ["web/index.html", "web/404.html"];
const FAVICON = "web/public/favicon.svg";
// Rendered from the favicon on the page background by `make icons`.
const TOUCH_ICON = "web/public/apple-touch-icon.png";

/** A token's dark colour, as #rrggbb; the site has no light mode. */
const token = (name) => resolve(semanticTokens[name].dark);

/** The colour of a PNG's top-left pixel, as #rrggbb. */
function pngCorner(file) {
  const png = fs.readFileSync(path.join(ROOT, file));
  const chunks = {};
  for (let at = 8; at < png.length;) {
    const length = png.readUInt32BE(at);
    const type = png.toString("latin1", at + 4, at + 8);
    const data = png.subarray(at + 8, at + 8 + length);
    chunks[type] =
      type === "IDAT" && chunks.IDAT
        ? Buffer.concat([chunks.IDAT, data])
        : data;
    at += 12 + length;
  }
  const bitDepth = chunks.IHDR[8];
  const colorType = chunks.IHDR[9];
  // Skip the first row's filter byte. Whatever the filter, the first pixel of
  // the first row is stored as is.
  const pixel = zlib.inflateSync(chunks.IDAT).subarray(1);
  let rgb;
  if (colorType === 3) {
    const index = pixel[0] >> (8 - bitDepth);
    rgb = chunks.PLTE.subarray(index * 3, index * 3 + 3);
  } else if (bitDepth === 8 && (colorType === 2 || colorType === 6)) {
    rgb = pixel.subarray(0, 3);
  } else {
    throw new Error(
      `${file}: unsupported PNG colour type ${colorType}, depth ${bitDepth}`
    );
  }
  return "#" + Buffer.from(rgb).toString("hex");
}

function check() {
  const problems = [];
  const expect = (file, what, actual, name) => {
    if (actual !== token(name)) {
      problems.push(
        `${file}: ${what} is ${actual}, but ${name} is ${token(name)}`
      );
    }
  };
  for (const file of PAGES) {
    const html = fs.readFileSync(path.join(ROOT, file), "utf8");
    const meta = html.match(/<meta name="theme-color" content="([^"]*)">/);
    expect(file, "theme-color", meta?.[1], "accent");
  }
  const svg = fs.readFileSync(path.join(ROOT, FAVICON), "utf8");
  const fills = new Set(
    [...svg.matchAll(/fill="(#[0-9a-f]{6})"/gi)].map((m) => m[1].toLowerCase())
  );
  const wanted = new Set([token("accent"), token("text-heading")]);
  if (fills.symmetricDifference(wanted).size > 0) {
    problems.push(
      `${FAVICON}: fills are ${[...fills].join(", ")}, but accent and text-heading are ${[...wanted].join(", ")}`
    );
  }
  expect(TOUCH_ICON, "the background", pngCorner(TOUCH_ICON), "bg-page");
  if (problems.length > 0) {
    console.error(problems.join("\n"));
    console.error(
      "Update the files, then run make icons if the favicon or bg-page changed."
    );
    process.exit(1);
  }
  console.log("colours: the copies match the tokens");
}

const [command, name] = process.argv.slice(2);
if (command === "check") {
  check();
} else if (command === "get" && name in semanticTokens) {
  console.log(token(name));
} else {
  console.error("usage: colors.mjs get <token> | check");
  process.exit(2);
}
