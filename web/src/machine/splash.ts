import type { Terminal } from "@xterm/xterm";

const BAR_WIDTH = 24;
const RED = "\x1b[31m";
const RESET = "\x1b[0m";

const mib = (bytes: number) => (bytes / 1024 / 1024).toFixed(1);

function progressBar(loaded: number, total: number) {
  const filled = Math.round((BAR_WIDTH * loaded) / total);
  const bar = "=".repeat(filled) + " ".repeat(BAR_WIDTH - filled);
  return `[${bar}] ${mib(loaded)} / ${mib(total)} MiB`;
}

/** What the terminal shows while the snapshot downloads. */
export function showSplash(term: Terminal) {
  term.write(
    "wxx9248.top\r\n\r\n" +
      "  Restoring a snapshot of Alpine Linux (i686)\r\n\r\n"
  );
  return {
    progress(loaded: number, total: number) {
      term.write(`\r  ${progressBar(loaded, total)}`);
    },
    fail(error: unknown) {
      term.write(
        `\r\n\r\n  ${RED}The machine failed to start: ${error}${RESET}\r\n` +
          "  Reload the page to try again, or read the plain page instead.\r\n"
      );
    }
  };
}
