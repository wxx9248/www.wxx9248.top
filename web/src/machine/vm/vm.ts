// The page talks to the guest only through serial ports, so any emulator that
// implements this interface can stand in for v86 (see start.ts).
// tools/build-state.mjs loads this file in Node, which doesn't know the @/ alias.

/** ttyS0: the visitor's login shell. */
export const CONSOLE = 0;
/** ttyS1: the line protocol with the guest's hostagent. */
export const HOST_CHANNEL = 1;

export interface VM {
  write(port: number, data: Uint8Array): void;
  onOutput(port: number, listener: (byte: number) => void): void;
}

export type ProgressListener = (loaded: number, total: number) => void;
