// What the page does when the guest restarts, halts, powers off or panics. The
// guest kernel reports these on the power port (see vm/power-port.ts).

import type { Terminal } from "@xterm/xterm";
import { MACHINE_PARAM } from "@/mode.ts";
import type { PowerEvent, VM } from "./vm/vm.ts";

/**
 * After a panic the kernel still flushes its console and prints the end of the
 * panic; let the machine run this long before stopping it.
 */
const PANIC_GRACE_MS = 1000;

const HIDE_CURSOR = "\x1b[?25l";

/** What the terminal says once the machine has stopped. */
const STOPPED = {
  "halt": "System halted.",
  "power-off": "Powered off.",
  "panic": "The kernel panicked."
} as const;

/**
 * Restart reloads the page, which restores the snapshot again. Halt, power-off
 * and panic stop the machine and offer a button (or Enter) that refreshes the
 * page, named for what it does. Only the first event counts.
 */
export function connectPower(vm: VM, term: Terminal, button: HTMLElement) {
  let handled = false;
  let stopped = false;
  // Back to the machine, even where the page would otherwise pick the plain
  // page, e.g. a desktop window narrowed since the visit began.
  const reload = () => {
    history.replaceState(null, "", `?${MACHINE_PARAM}`);
    location.reload();
  };

  const stop = async (event: keyof typeof STOPPED) => {
    stopped = true;
    // The CPU runs on to the end of its time slice: after a halt the kernel
    // still prints "reboot: System halted". Write once it has stopped, and in a
    // frame, after that output, which console.ts writes once per frame.
    await vm.stop();
    requestAnimationFrame(() =>
      term.write(
        `\r\n\r\n  ${STOPPED[event]}\r\n  Press Enter to refresh the page.\r\n${HIDE_CURSOR}`
      )
    );
    button.hidden = false;
    button.focus();
  };

  button.addEventListener("click", reload);
  // Enter on its own: a pasted line ending in a newline isn't a key press.
  term.onData((data) => {
    if (stopped && data === "\r") reload();
  });

  vm.onPower((event: PowerEvent) => {
    if (handled) return;
    handled = true;
    if (event === "restart") {
      vm.stop().then(reload);
    } else if (event === "panic") {
      setTimeout(() => stop(event), PANIC_GRACE_MS);
    } else {
      stop(event);
    }
  });
}
