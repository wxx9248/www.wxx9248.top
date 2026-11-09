#!/usr/bin/env node
// The v86 npm package ships only the emulator. Fetch the BIOS images and the
// root filesystem tools from the commit that package was built from, so the
// version in package.json is the only one to keep up to date.
//
// Output: build/v86/{bios,tools}/... and build/v86/COMMIT

import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const ROOT = path.join(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "build/v86");
const REPO = "copy/v86";
const FILES = [
  "LICENSE",
  "bios/COPYING.LESSER",
  "bios/seabios.bin",
  "bios/vgabios.bin",
  "tools/fs2json.py",
  "tools/copy-to-sha256.py"
];

// CI runners share addresses, so unauthenticated API requests can hit GitHub's
// rate limit there. Send the workflow's token, and only to the API.
const API = "https://api.github.com/";
const TOKEN = process.env.GITHUB_TOKEN;

async function get(url) {
  const headers =
    TOKEN && url.startsWith(API) ? { authorization: `Bearer ${TOKEN}` } : {};
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response;
}

// Release versions look like 0.5.471+g94faf3d.
const { version } = JSON.parse(
  fs.readFileSync(path.join(ROOT, "node_modules/v86/package.json"), "utf8")
);
const short = version.match(/\+g([0-9a-f]+)$/)?.[1];
if (!short)
  throw new Error(`v86 ${version} does not name the commit it was built from`);

// GitHub also resolves short hashes to commits pushed to forks, so take only a
// commit that is on upstream master.
const { sha } = await (
  await get(`${API}repos/${REPO}/commits/${short}`)
).json();
const { status } = await (
  await get(`${API}repos/${REPO}/compare/${sha}...master`)
).json();
if (status !== "ahead" && status !== "identical")
  throw new Error(`${sha} is not on ${REPO} master (${status})`);

fs.rmSync(OUT, { recursive: true, force: true });
for (const file of FILES) {
  const data = await (
    await get(`https://raw.githubusercontent.com/${REPO}/${sha}/${file}`)
  ).bytes();
  fs.mkdirSync(path.dirname(path.join(OUT, file)), { recursive: true });
  fs.writeFileSync(path.join(OUT, file), data);
}
// Written last: the Makefile treats this file as "fetch complete".
fs.writeFileSync(path.join(OUT, "COMMIT"), `${sha}\n`);
console.log(
  `v86 ${version}: fetched ${FILES.length} files from ${sha.slice(0, 12)}`
);
