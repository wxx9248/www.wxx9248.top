// The page's mode lives in <html data-mode>. head.ts sets it before first paint,
// and plain/plain.css hides the plain page in machine mode.

export type Mode = "plain" | "machine";

/** `?machine` forces machine mode, e.g. after the visitor presses the boot button. */
export const MACHINE_PARAM = "machine";
/** `?plain` forces the plain page; the machine's escape link in index.html uses it. */
export const PLAIN_PARAM = "plain";

export const getMode = () => document.documentElement.dataset.mode as Mode;

export function setMode(mode: Mode) {
  document.documentElement.dataset.mode = mode;
}
