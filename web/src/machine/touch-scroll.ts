import type { Terminal } from "@xterm/xterm";

const ESC = "\x1b";

/**
 * Scroll `term` with a finger, which xterm.js doesn't do on its own. At the
 * shell a swipe scrolls back through the output. Full-screen programs such as
 * less and vim have no scrollback, so there it sends arrow keys, as most
 * terminals do for the mouse wheel.
 */
export function enableTouchScroll(term: Terminal, container: HTMLElement) {
  let lastY: number | undefined;
  /** Pixels swiped that don't add up to a whole line yet. */
  let carry = 0;

  const scroll = (lines: number) => {
    if (term.buffer.active.type === "normal") {
      term.scrollLines(lines);
      return;
    }
    const mode = term.modes.applicationCursorKeysMode ? "O" : "[";
    const key = `${ESC}${mode}${lines > 0 ? "B" : "A"}`;
    term.input(key.repeat(Math.abs(lines)));
  };

  container.addEventListener(
    "touchstart",
    (event) => {
      lastY = event.touches.length === 1 ? event.touches[0].clientY : undefined;
      carry = 0;
    },
    { passive: true }
  );

  // Captured, so xterm's own touch handling doesn't see the swipe as well.
  container.addEventListener(
    "touchmove",
    (event) => {
      if (lastY === undefined || event.touches.length !== 1) return;
      event.preventDefault();
      event.stopPropagation();
      const y = event.touches[0].clientY;
      const lineHeight = container.clientHeight / term.rows;
      // Finger up shows later lines, like the wheel turning down.
      carry += lastY - y;
      lastY = y;
      const lines = Math.trunc(carry / lineHeight);
      if (lines === 0) return;
      carry -= lines * lineHeight;
      scroll(lines);
    },
    { passive: false, capture: true }
  );
}
