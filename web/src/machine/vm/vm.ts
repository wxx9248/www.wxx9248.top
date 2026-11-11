// The page talks to the guest through serial ports and hears its power events
// on the power port, so any emulator that implements this interface can stand
// in for v86 (see start.ts).
// snapshot/build.mjs and machine.mjs load this file in Node, which doesn't know
// the @/ alias.

/** ttyS0: the visitor's login shell. */
export const CONSOLE = 0;
/** ttyS1: the line protocol with the guest's hostagent. */
export const HOST_CHANNEL = 1;

export interface VM {
  write(port: number, data: Uint8Array): void;
  onOutput(port: number, listener: (byte: number) => void): void;
  /** The guest restarted, halted, powered off or panicked. */
  onPower(listener: (event: PowerEvent) => void): void;
  /**
   * Stop the emulated CPU for good; later writes are ignored. Resolves once it
   * has stopped, so the guest prints nothing after that.
   */
  stop(): Promise<void>;
}

export type ProgressListener = (loaded: number, total: number) => void;

/** What the guest kernel reports on the power port; see power-port.ts. */
export type PowerEvent = "restart" | "halt" | "power-off" | "panic";
