// The power port: the guest kernel's host-power driver writes one byte to it
// when the machine restarts, halts, powers off or panics. The driver is
// kernel/patches/0001-*.patch (drivers/misc/host-power.c), and its #defines
// must match these values. Only kernel code (or root) can write I/O ports, so
// a visitor can't fake an event.
//
// This file and start.ts are the only ones that know about v86. It is also
// loaded by snapshot/test.mjs in Node, which strips the types, so it uses
// only erasable TypeScript.

import type { PowerEvent } from "./vm.ts";

const POWER_PORT = 0x600;

const POWER_EVENTS: Readonly<Record<number, PowerEvent>> = {
  1: "restart",
  2: "halt",
  3: "power-off",
  4: "panic"
};

/** The parts of v86's I/O port table this file uses (v86 internals). */
interface V86PortTable {
  ports: { write8: unknown }[];
  empty_port_write: unknown;
  register_write(
    port: number,
    device: object,
    write8: (value: number) => void
  ): void;
}

type PowerListener = (event: PowerEvent) => void;

/** Each emulator's listeners; its port is registered with the first one. */
const listeners = new WeakMap<object, PowerListener[]>();

/**
 * Call `listener` for each event the guest writes to the power port; unknown
 * codes are ignored. Any number of listeners can listen to one emulator.
 * `emulator` is a V86 instance: the port table is a v86 internal, which is
 * safe to use because package.json pins v86's version.
 */
export function listenToPowerPort(emulator: object, listener: PowerListener) {
  const registered = listeners.get(emulator);
  if (registered) {
    registered.push(listener);
    return;
  }
  const io = (emulator as { v86: { cpu: { io: V86PortTable } } }).v86.cpu.io;
  if (io.ports[POWER_PORT].write8 !== io.empty_port_write)
    throw new Error(`I/O port 0x${POWER_PORT.toString(16)} is already in use`);
  const all = [listener];
  listeners.set(emulator, all);
  io.register_write(POWER_PORT, { name: "power" }, (value) => {
    const event = POWER_EVENTS[value];
    if (event) for (const each of all) each(event);
  });
}
