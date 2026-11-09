#!/usr/bin/env node
// Restore the built snapshot headlessly, the way the page does, and time the
// load, the resume and a set of shell workloads. Used to compare kernel builds.
//
//   node snapshot/bench.mjs --label <name> [--runs N] [--timeout S] [--workload <cmd>]...
//   node snapshot/bench.mjs --compare <a.json> <b.json>...
//
// Output: build/bench/<name>.json

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import zlib from "node:zlib";
import { V86 } from "v86";

import {
  MEMORY_SIZE,
  VGA_MEMORY_SIZE,
  NET_DEVICE
} from "../web/src/machine/vm/config.ts";
import { CONSOLE, HOST_CHANNEL } from "../web/src/machine/vm/vm.ts";

const ROOT = path.join(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const STATE = path.join(ROOT, "build/snapshot");
const OUT = path.join(ROOT, "build/bench");
// As many random bytes as host-channel.ts sends with resume.
const ENTROPY_BYTES = 32;

// What visitors do: run commands, start programs, read files and /proc.
const WORKLOADS = [
  ["ls", "ls -lR /usr"],
  ["forks", "for i in $(seq 300); do /bin/true; done"],
  ["grep", "grep -r zzzz /usr/share/vim"],
  ["vim", "vim -es -c q /etc/profile"],
  ["gpg", "gpg -k"],
  // Pure user-space CPU: the control, which the kernel shouldn't affect.
  ["awk", "awk 'BEGIN{for(i=0;i<300000;i++)s+=i}'"],
  // -d 0: no sleep between screens, which would dominate the time.
  ["top", "top -b -n 10 -d 0"]
];

const args = process.argv.slice(2);
if (args[0] === "--compare") {
  compare(args.slice(1));
  process.exit(0);
}

let label;
let runs = 5;
let timeoutSeconds = 120;
const custom = [];
for (let i = 0; i < args.length; i++) {
  const value = args[++i];
  if (args[i - 1] === "--label") label = value;
  else if (args[i - 1] === "--runs") runs = Number(value);
  else if (args[i - 1] === "--timeout") timeoutSeconds = Number(value);
  else if (args[i - 1] === "--workload") custom.push(value);
  else usage();
}
if (!label || !(runs > 0) || !(timeoutSeconds > 0)) usage();
const workloads = custom.length
  ? custom.map((command, i) => [`custom${i + 1}`, command])
  : WORKLOADS;

function usage() {
  console.error(
    "usage: bench.mjs --label <name> [--runs N] [--timeout S] [--workload <cmd>]...\n" +
      "       bench.mjs --compare <a.json> <b.json>..."
  );
  process.exit(2);
}

const ms = (start) => Math.round(performance.now() - start);

const manifest = JSON.parse(
  fs.readFileSync(path.join(STATE, "manifest.json"), "utf8")
);
const compressed = Buffer.concat(
  manifest.parts.map((name) => fs.readFileSync(path.join(STATE, "parts", name)))
);
let start = performance.now();
const state = zlib.zstdDecompressSync(compressed);
const decompressMs = ms(start);

start = performance.now();
const emulator = new V86({
  wasm_path: path.join(ROOT, "node_modules/v86/build/v86.wasm"),
  memory_size: MEMORY_SIZE,
  vga_memory_size: VGA_MEMORY_SIZE,
  net_device: NET_DEVICE,
  uart1: true,
  filesystem: { baseurl: path.join(ROOT, "build/image/flat") },
  initial_state: {
    buffer: state.buffer.slice(
      state.byteOffset,
      state.byteOffset + state.length
    )
  },
  disable_keyboard: true,
  disable_mouse: true,
  disable_speaker: true,
  autostart: true
});
await new Promise((resolve) =>
  emulator.add_listener("emulator-started", resolve)
);
const restoreMs = ms(start);

// Everything the console prints; waits search it from a position onwards.
let output = "";
const waiters = new Set();
emulator.add_listener(`serial${CONSOLE}-output-byte`, (byte) => {
  output += String.fromCharCode(byte);
  for (const waiter of waiters) waiter();
});

/** Resolve with the output from `from` once `done` matches it. */
function waitFor(from, done, name) {
  return new Promise((resolve) => {
    const timer = setTimeout(async () => {
      console.error(`bench: ${name} timed out after ${timeoutSeconds} s`);
      await emulator.destroy();
      process.exit(1);
    }, timeoutSeconds * 1000);
    const check = () => {
      const text = output.slice(from);
      if (!done(text)) return;
      clearTimeout(timer);
      waiters.delete(check);
      resolve(text);
    };
    waiters.add(check);
    check();
  });
}

const typeLine = (line) =>
  emulator.serial_send_bytes(CONSOLE, new TextEncoder().encode(line + "\r"));

// The prompt may be followed by colour resets and a window-title sequence.
const stripEscapes = (text) =>
  text.replace(/\x1b\][^\x07]*\x07|\x1b\[[0-9;?]*[A-Za-z]/g, "");

start = performance.now();
let from = output.length;
const entropy = crypto.randomBytes(ENTROPY_BYTES).toString("hex");
emulator.serial_send_bytes(
  HOST_CHANNEL,
  new TextEncoder().encode(
    `resume ${Math.floor(Date.now() / 1000)} ${entropy}\n`
  )
);
await waitFor(from, (text) => stripEscapes(text).endsWith("$ "), "resume");
const resumeMs = ms(start);

// Each wait looks for a marker the command computes, so the echo of the typed
// line, which shows $((k+0)) and not its value, can't match it.
let marker = 0;
async function run(command, name) {
  const k = ++marker;
  from = output.length;
  const begin = performance.now();
  typeLine(`${command} >/dev/null 2>&1; echo __DONE$((${k}+0))`);
  await waitFor(from, (text) => text.includes(`__DONE${k}\r`), name);
  return ms(begin);
}

/** [user + nice, system + irq + softirq] ticks so far, from /proc/stat. */
async function cpuTicks() {
  const k = ++marker;
  from = output.length;
  typeLine(`head -1 /proc/stat; echo __STAT$((${k}+0))`);
  const text = await waitFor(
    from,
    (text) => text.includes(`__STAT${k}\r`),
    "/proc/stat"
  );
  const [user, nice, system, , , irq, softirq] = text
    .match(/^cpu +([\d ]+)/m)[1]
    .split(" ")
    .map(Number);
  return [user + nice, system + irq + softirq];
}

const results = [];
for (const [name, command] of workloads) {
  const before = await cpuTicks();
  const firstMs = await run(command, name);
  const after = await cpuTicks();
  const times = [];
  for (let i = 0; i < runs; i++) times.push(await run(command, name));
  times.sort((a, b) => a - b);
  results.push({
    name,
    command,
    firstMs,
    medianMs: times[Math.floor(times.length / 2)],
    minMs: times[0],
    maxMs: times[times.length - 1],
    userTicks: after[0] - before[0],
    kernelTicks: after[1] - before[1]
  });
  console.log(
    `${name.padEnd(8)} first ${String(firstMs).padStart(6)} ms  ` +
      `median ${String(results.at(-1).medianMs).padStart(6)} ms ` +
      `(${results.at(-1).minMs}-${results.at(-1).maxMs})  ` +
      `ticks user ${after[0] - before[0]} kernel ${after[1] - before[1]}`
  );
}
await emulator.destroy();

const report = {
  label,
  date: new Date().toISOString(),
  snapshotBytes: compressed.length,
  decompressMs,
  restoreMs,
  resumeMs,
  workloads: results
};
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(
  path.join(OUT, `${label}.json`),
  JSON.stringify(report, null, 2) + "\n"
);
console.log(
  `snapshot ${(compressed.length / 1024 / 1024).toFixed(1)} MiB, ` +
    `decompress ${decompressMs} ms, restore ${restoreMs} ms, resume ${resumeMs} ms`
);
console.log(`Wrote build/bench/${label}.json`);
process.exit(0);

/** Print the reports side by side, one row per metric. */
function compare(files) {
  if (!files.length) usage();
  const reports = files.map((file) =>
    JSON.parse(fs.readFileSync(file, "utf8"))
  );
  const rows = [
    [
      "snapshot MiB",
      ...reports.map((r) => (r.snapshotBytes / 1024 / 1024).toFixed(1))
    ],
    ["decompress ms", ...reports.map((r) => r.decompressMs)],
    ["restore ms", ...reports.map((r) => r.restoreMs)],
    ["resume ms", ...reports.map((r) => r.resumeMs)]
  ];
  const names = [
    ...new Set(reports.flatMap((r) => r.workloads.map((w) => w.name)))
  ];
  for (const name of names) {
    for (const key of ["firstMs", "medianMs"]) {
      rows.push([
        `${name} ${key === "firstMs" ? "first" : "median"} ms`,
        ...reports.map(
          (r) => r.workloads.find((w) => w.name === name)?.[key] ?? "-"
        )
      ]);
    }
  }
  const header = ["", ...reports.map((r) => r.label)];
  const width = Math.max(...[header, ...rows].flat().map((c) => `${c}`.length));
  for (const row of [header, ...rows]) {
    console.log(
      row
        .map((cell, i) =>
          i ? `${cell}`.padStart(width) : `${cell}`.padEnd(18)
        )
        .join("  ")
    );
  }
}
