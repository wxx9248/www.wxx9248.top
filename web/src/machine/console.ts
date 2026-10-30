import type { Terminal } from "@xterm/xterm";
import { CONSOLE, type VM } from "./vm/vm.ts";

/**
 * Connect the terminal to the guest's console in both directions. `filter`
 * sees everything typed before the guest does (see extra-keys.ts).
 */
export function connectConsole(
  term: Terminal,
  vm: VM,
  filter: (data: string) => string
) {
  // Batch output so xterm parses one chunk per frame, not one byte at a time.
  let pending: number[] = [];
  vm.onOutput(CONSOLE, (byte) => {
    if (pending.length === 0)
      requestAnimationFrame(() => {
        term.write(new Uint8Array(pending));
        pending = [];
      });
    pending.push(byte);
  });

  const encoder = new TextEncoder();
  term.onData((data) => vm.write(CONSOLE, encoder.encode(filter(data))));
  term.onBinary((data) =>
    vm.write(
      CONSOLE,
      Uint8Array.from(data, (c) => c.charCodeAt(0))
    )
  );
}
