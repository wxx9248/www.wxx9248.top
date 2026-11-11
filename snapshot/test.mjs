#!/usr/bin/env node
// Restore the built snapshot headlessly and check that the machine reaches a
// prompt, and that restart, halt, power-off and panic reach the page through
// the power port, while nothing a visitor types without root does.
//
//   node snapshot/test.mjs     (make test)

import { loadSnapshot, startMachine } from "./machine.mjs";
import { listenToPowerPort } from "../web/src/machine/vm/power-port.ts";

const TIMEOUT_SECONDS = 60;
// How long the "no fake" case waits for an event that shouldn't come.
const QUIET_MS = 2000;
// How long after the panic event the end of the panic must appear. The page
// waits 1000 ms (PANIC_GRACE_MS in power.ts); this is wall-clock time, so the
// test allows more, in case a busy CI runner runs the emulator slowly.
const PANIC_END_MS = 5000;

/** Resolve after `ms` milliseconds. */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const CASES = [
  { name: "prompt" },
  {
    name: "no fake",
    command: 'echo "reboot: Restarting system"',
    async check(machine, events, from) {
      await machine.waitFor(
        from,
        (text) => machine.stripEscapes(text).endsWith("$ "),
        "prompt after echo"
      );
      await sleep(QUIET_MS);
      if (events.length) throw new Error(`unexpected event ${events[0].event}`);
    }
  },
  { name: "restart", command: "doas reboot", expect: "restart" },
  { name: "halt", command: "doas halt", expect: "halt" },
  {
    name: "power-off",
    command: "doas poweroff",
    expect: "power-off",
    async after(machine, first) {
      const before = machine.output().slice(0, first.at);
      if (!before.includes("reboot: Power down"))
        throw new Error("no 'reboot: Power down' before the event");
    }
  },
  {
    name: "panic",
    command: "doas sh -c 'echo 1 > /proc/sys/vm/panic_on_oom'; tail /dev/zero",
    expect: "panic",
    async after(machine, first) {
      const ended = () =>
        machine.output().slice(first.at).includes("end Kernel panic");
      const started = Date.now();
      while (!ended() && Date.now() - started < PANIC_END_MS) await sleep(50);
      if (!ended())
        throw new Error(
          `no 'end Kernel panic' within ${PANIC_END_MS} ms of the event`
        );
    }
  }
];

/** Resolve with the first event, or reject after TIMEOUT_SECONDS. */
function firstEvent(events) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const poll = setInterval(() => {
      if (events.length) {
        clearInterval(poll);
        resolve(events[0]);
      } else if (Date.now() - started > TIMEOUT_SECONDS * 1000) {
        clearInterval(poll);
        reject(new Error(`no event within ${TIMEOUT_SECONDS} s`));
      }
    }, 50);
  });
}

const { state } = loadSnapshot();
let failed = 0;
for (const test of CASES) {
  const machine = await startMachine(state, {
    timeoutSeconds: TIMEOUT_SECONDS
  });
  // Each event with the console's length when it arrived.
  const events = [];
  // A second listener on the same machine gets every event too.
  const seconded = [];
  try {
    listenToPowerPort(machine.emulator, (event) =>
      events.push({ event, at: machine.output().length })
    );
    listenToPowerPort(machine.emulator, (event) => seconded.push(event));
    await machine.resume();
    if (test.command) {
      const from = machine.output().length;
      machine.typeLine(test.command);
      if (test.check) await test.check(machine, events, from);
    }
    if (test.expect) {
      const first = await firstEvent(events);
      if (first.event !== test.expect)
        throw new Error(`first event ${first.event}, not ${test.expect}`);
      if (seconded[0] !== first.event)
        throw new Error("the second listener didn't get the event");
      if (test.after) await test.after(machine, first);
    }
    console.log(`PASS ${test.name}`);
  } catch (error) {
    failed++;
    console.log(`FAIL ${test.name}: ${error.message}`);
    console.log(
      machine.stripEscapes(machine.output().slice(-2000)).replace(/^/gm, "  | ")
    );
  }
  await machine.destroy();
}
console.log(failed ? `${failed} of ${CASES.length} failed` : "all passed");
process.exit(failed ? 1 : 0);
