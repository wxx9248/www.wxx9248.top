// Line protocol with /usr/local/sbin/hostagent in the guest, over ttyS1.

import { HOST_CHANNEL, type VM } from "./vm/vm.ts";

const NEWLINE = "\n".charCodeAt(0);
/** Longer lines are dropped whole; the guest's `open` sends at most 2048 characters. */
const MAX_LINE_BYTES = 16 * 1024;
/** A URL is one word: no whitespace or control characters. */
const URL_WORD = /^[^\s\p{Cc}]+$/u;
/** Seeds the guest's /dev/urandom after a restore. */
const ENTROPY_BYTES = 32;

export interface HostChannel {
  resize(rows: number, cols: number): void;
  resume(): void;
}

export function connectHostChannel(
  vm: VM,
  handlers: { open(url: string): void }
): HostChannel {
  const encoder = new TextEncoder();
  const send = (line: string) =>
    vm.write(HOST_CHANNEL, encoder.encode(line + "\n"));

  // The guest is untrusted: it can send anything, of any length.
  let line: number[] = [];
  let tooLong = false;
  vm.onOutput(HOST_CHANNEL, (byte) => {
    if (byte !== NEWLINE) {
      if (line.length < MAX_LINE_BYTES) line.push(byte);
      else tooLong = true;
      return;
    }
    const message = new TextDecoder().decode(new Uint8Array(line)).trim();
    const dropped = tooLong;
    line = [];
    tooLong = false;
    if (dropped) return;
    const [command, ...args] = message.split(" ");
    if (command === "open" && args.length === 1 && URL_WORD.test(args[0]))
      handlers.open(args[0]);
  });

  return {
    resize: (rows, cols) => send(`resize ${rows} ${cols}`),
    resume() {
      // The snapshot froze the guest's clock and RNG state at build time.
      const entropy = crypto.getRandomValues(new Uint8Array(ENTROPY_BYTES));
      const hex = Array.from(entropy, (b) =>
        b.toString(16).padStart(2, "0")
      ).join("");
      const epochSeconds = Math.floor(Date.now() / 1000);
      send(`resume ${epochSeconds} ${hex}`);
    }
  };
}
