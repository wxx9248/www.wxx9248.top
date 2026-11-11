// Restore the built snapshot headlessly, the way the page does, and drive the
// console. Shared by bench.mjs and test.mjs.

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
// As many random bytes as host-channel.ts sends with resume.
const ENTROPY_BYTES = 32;

const ms = (start) => Math.round(performance.now() - start);

/** The snapshot parts in build/snapshot, joined and decompressed. */
export function loadSnapshot() {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(STATE, "manifest.json"), "utf8")
  );
  const compressed = Buffer.concat(
    manifest.parts.map((name) =>
      fs.readFileSync(path.join(STATE, "parts", name))
    )
  );
  const start = performance.now();
  const state = zlib.zstdDecompressSync(compressed);
  return {
    state,
    compressedBytes: compressed.length,
    decompressMs: ms(start)
  };
}

// The prompt may be followed by colour resets and a window-title sequence.
const stripEscapes = (text) =>
  text.replace(/\x1b\][^\x07]*\x07|\x1b\[[0-9;?]*[A-Za-z]/g, "");

/**
 * Restore `state` (from loadSnapshot) in a new emulator. Each call gets its own
 * copy, so one snapshot can be restored any number of times.
 */
export async function startMachine(state, { timeoutSeconds }) {
  const start = performance.now();
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
    return new Promise((resolve, reject) => {
      const check = () => {
        const text = output.slice(from);
        if (!done(text)) return;
        clearTimeout(timer);
        waiters.delete(check);
        resolve(text);
      };
      const timer = setTimeout(() => {
        waiters.delete(check);
        reject(new Error(`${name} timed out after ${timeoutSeconds} s`));
      }, timeoutSeconds * 1000);
      waiters.add(check);
      check();
    });
  }

  const typeLine = (line) =>
    emulator.serial_send_bytes(CONSOLE, new TextEncoder().encode(line + "\r"));

  /** Send what the page sends after a restore, and wait for the prompt. */
  async function resume() {
    const begin = performance.now();
    const from = output.length;
    const entropy = crypto.randomBytes(ENTROPY_BYTES).toString("hex");
    emulator.serial_send_bytes(
      HOST_CHANNEL,
      new TextEncoder().encode(
        `resume ${Math.floor(Date.now() / 1000)} ${entropy}\n`
      )
    );
    await waitFor(from, (text) => stripEscapes(text).endsWith("$ "), "resume");
    return ms(begin);
  }

  return {
    emulator,
    restoreMs,
    output: () => output,
    waitFor,
    typeLine,
    resume,
    stripEscapes,
    destroy: () => emulator.destroy()
  };
}
