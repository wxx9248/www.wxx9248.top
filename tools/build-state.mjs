#!/usr/bin/env node
// Boot the guest headlessly once, wait until the visitor's login shell is parked
// in await-resume, and save a v86 state snapshot. Visitors restore this snapshot
// instead of booting, so the page reaches a prompt in about a second.
//
// Output: build/state/parts/state-<hash>.<n>.zst and build/state/manifest.json

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import zlib from "node:zlib";
import { V86 } from "v86";

import {
  MEMORY_SIZE,
  VGA_MEMORY_SIZE,
  NET_DEVICE,
  CMDLINE
} from "../web/src/machine/vm/config.ts";
import { CONSOLE, HOST_CHANNEL } from "../web/src/machine/vm/vm.ts";

const ROOT = path.join(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const IMAGE = path.join(ROOT, "build/image");
const OUT = path.join(ROOT, "build/state");
const PART_SIZE = 4 * 1024 * 1024;
// Stock linux-virt keeps ~16 MB of kernel in RAM; a slimmer kernel would shrink this.
const MAX_COMPRESSED = 10 * 1024 * 1024;
const BOOT_TIMEOUT_MS = 5 * 60 * 1000;
// Let the console output settle after the guest reports "dropped".
const SETTLE_MS = 1000;
const ZSTD_LEVEL = 19;
// Hex digits of the snapshot's SHA-256 in its part names.
const HASH_LENGTH = 16;
// Kernel argument that parks the login shell for the snapshot; checked by
// image/overlay/etc/skel/.bash_profile.
const SNAPSHOT_FLAG = "resume.snapshot";
const verbose = process.argv.includes("--verbose");

const emulator = new V86({
  wasm_path: path.join(ROOT, "node_modules/v86/build/v86.wasm"),
  bios: { url: path.join(ROOT, "build/v86/bios/seabios.bin") },
  vga_bios: { url: path.join(ROOT, "build/v86/bios/vgabios.bin") },
  memory_size: MEMORY_SIZE,
  vga_memory_size: VGA_MEMORY_SIZE,
  net_device: NET_DEVICE,
  uart1: true,
  autostart: true,
  bzimage_initrd_from_filesystem: true,
  cmdline: `${CMDLINE} ${SNAPSHOT_FLAG}`,
  filesystem: {
    baseurl: path.join(IMAGE, "flat"),
    basefs: path.join(IMAGE, "fs.json")
  }
});

const timeout = setTimeout(() => {
  console.error(
    "Timed out waiting for the guest to boot (rerun with --verbose)"
  );
  process.exit(1);
}, BOOT_TIMEOUT_MS);

if (verbose) {
  emulator.add_listener(`serial${CONSOLE}-output-byte`, (byte) =>
    process.stdout.write(String.fromCharCode(byte))
  );
}

const send = (line) =>
  emulator.serial_send_bytes(
    HOST_CHANNEL,
    new TextEncoder().encode(line + "\n")
  );

let line = "";
emulator.add_listener(`serial${HOST_CHANNEL}-output-byte`, (byte) => {
  const c = String.fromCharCode(byte);
  if (c !== "\n") {
    line += c;
    return;
  }
  const message = line.trim();
  line = "";
  console.log("guest:", message);
  if (message === "await") {
    send("drop-caches");
  } else if (message === "dropped") {
    setTimeout(save, SETTLE_MS);
  }
});

console.log("Booting guest, this takes a minute...");

async function save() {
  clearTimeout(timeout);
  await emulator.stop();
  // The VGA framebuffer is never shown (serial console only) but holds 2 MiB
  // of incompressible noise. Blank it.
  emulator.v86.cpu.devices.vga.svga_memory.fill(0);
  const state = new Uint8Array(await emulator.save_state());
  await emulator.destroy();

  const compressed = zlib.zstdCompressSync(state, {
    params: {
      [zlib.constants.ZSTD_c_compressionLevel]: ZSTD_LEVEL,
      [zlib.constants.ZSTD_c_contentSizeFlag]: 1
    },
    pledgedSrcSize: state.length
  });
  const hash = crypto
    .createHash("sha256")
    .update(compressed)
    .digest("hex")
    .slice(0, HASH_LENGTH);

  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(path.join(OUT, "parts"), { recursive: true });
  const parts = [];
  for (
    let offset = 0, n = 0;
    offset < compressed.length;
    offset += PART_SIZE, n++
  ) {
    const name = `state-${hash}.${n}.zst`;
    fs.writeFileSync(
      path.join(OUT, "parts", name),
      compressed.subarray(offset, offset + PART_SIZE)
    );
    parts.push(name);
  }
  fs.writeFileSync(
    path.join(OUT, "manifest.json"),
    JSON.stringify({ size: compressed.length, parts }, null, 2) + "\n"
  );

  const mb = (n) => (n / 1024 / 1024).toFixed(1) + " MiB";
  console.log(
    `State: ${mb(state.length)} raw, ${mb(compressed.length)} compressed, ${parts.length} part(s)`
  );
  if (compressed.length > MAX_COMPRESSED) {
    console.error(`State exceeds the ${mb(MAX_COMPRESSED)} budget`);
    process.exit(1);
  }
  process.exit(0);
}
