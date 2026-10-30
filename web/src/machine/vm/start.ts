// The only module that knows about v86.

import { V86, type V86Options } from "v86";
import wasmUrl from "v86/build/v86.wasm?url";

import { VM_FLAT_URL } from "@/site.ts";
import { MEMORY_SIZE, NET_DEVICE, VGA_MEMORY_SIZE } from "./config.ts";
import { fetchSnapshot } from "./snapshot.ts";
import type { ProgressListener, VM } from "./vm.ts";

/**
 * Download the snapshot and resume the machine it holds. A snapshot replaces
 * the whole machine, BIOS included, so the options for booting a kernel
 * (bios, cmdline and so on) are only in tools/build-state.mjs.
 */
export async function startVM(onProgress: ProgressListener): Promise<VM> {
  const initialState = await fetchSnapshot(onProgress);

  const emulator = new V86({
    wasm_path: wasmUrl,
    memory_size: MEMORY_SIZE,
    vga_memory_size: VGA_MEMORY_SIZE,
    net_device: NET_DEVICE as V86Options["net_device"],
    uart1: true,
    // The snapshot carries the 9p metadata; file contents load on first use.
    filesystem: { baseurl: VM_FLAT_URL },
    initial_state: { buffer: initialState },
    disable_keyboard: true,
    disable_mouse: true,
    disable_speaker: true,
    autostart: true
  });

  await new Promise<void>((resolve) =>
    emulator.add_listener("emulator-started", () => resolve())
  );

  return {
    write: (port, data) => emulator.serial_send_bytes(port, data),
    onOutput: (port, listener) =>
      emulator.add_listener(
        `serial${port}-output-byte` as "serial0-output-byte",
        listener
      )
  };
}
