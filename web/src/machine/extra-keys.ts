import type { Terminal } from "@xterm/xterm";

const ESC = "\x1b";
const DEL = "\x7f";
/** Shift-Tab, which terminals send as back tab. */
const BACK_TAB = `${ESC}[Z`;
/** Ctrl clears the top bits of a character: Ctrl-C is 0x43 & 0x1f = 0x03. */
const CTRL_MASK = 0x1f;
/** Ctrl applies to the characters from @ to ~; Ctrl-? is DEL. */
const CTRL_FIRST = "@".charCodeAt(0);
const CTRL_LAST = "~".charCodeAt(0);

type Arrow = "A" | "B" | "C" | "D";
type Modifier = "shift" | "ctrl" | "alt";

/**
 * xterm's modifier code in CSI 1;<code> sequences: 1 plus a bit for each
 * modifier, so Ctrl-Left is ESC [1;5D.
 */
const MODIFIER_BITS: Record<Modifier, number> = { shift: 1, alt: 2, ctrl: 4 };

function withCtrl(data: string) {
  if (data === "?") return DEL;
  if (data === " ") return "\0";
  const code = data.charCodeAt(0);
  if (data.length !== 1 || code < CTRL_FIRST || code > CTRL_LAST) return data;
  return String.fromCharCode(code & CTRL_MASK);
}

/**
 * Fill `bar` with the keys a phone keyboard lacks: Esc, Tab, Shift, Ctrl, Alt
 * and arrows. A modifier stays down until the next key, typed on the bar or on
 * the keyboard, and several can be down at once.
 *
 * Returns the filter for everything typed into the terminal, which applies the
 * modifiers.
 */
export function createExtraKeys(bar: HTMLElement, term: Terminal) {
  const key = (label: string, name: string, press: () => void) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    if ([...label].length === 1) button.classList.add("glyph");
    button.setAttribute("aria-label", name);
    // Taking focus from the terminal would close the phone keyboard.
    button.tabIndex = -1;
    button.addEventListener("pointerdown", (event) => event.preventDefault());
    button.addEventListener("click", () => {
      press();
      // In case the browser moved focus anyway; inside a tap, this reopens the keyboard.
      term.focus();
    });
    return button;
  };

  const down = new Set<Modifier>();
  const modifierKeys = new Map<Modifier, HTMLElement>();
  const setDown = (modifier: Modifier, isDown: boolean) => {
    if (isDown) down.add(modifier);
    else down.delete(modifier);
    modifierKeys.get(modifier)?.setAttribute("aria-pressed", String(isDown));
  };
  const release = () =>
    modifierKeys.forEach((_, modifier) => setDown(modifier, false));
  const modifierKey = (label: string, name: string, modifier: Modifier) => {
    const button = key(label, name, () =>
      setDown(modifier, !down.has(modifier))
    );
    modifierKeys.set(modifier, button);
    setDown(modifier, false);
    return button;
  };

  /** Type a key the bar has already applied the modifiers to. */
  const send = (data: string) => {
    release();
    term.input(data);
  };
  const alt = (data: string) => (down.has("alt") ? ESC + data : data);

  const arrowKey = (label: string, name: string, direction: Arrow) =>
    key(label, name, () => {
      if (down.size > 0) {
        let code = 1;
        for (const modifier of down) code += MODIFIER_BITS[modifier];
        send(`${ESC}[1;${code}${direction}`);
        return;
      }
      // vim and less switch the terminal to application mode, where arrows are ESC O.
      const mode = term.modes.applicationCursorKeysMode ? "O" : "[";
      send(`${ESC}${mode}${direction}`);
    });

  bar.replaceChildren(
    key("Esc", "Escape", () => send(alt(ESC))),
    key("Tab", "Tab", () => send(alt(down.has("shift") ? BACK_TAB : "\t"))),
    modifierKey("Shift", "Shift", "shift"),
    modifierKey("Ctrl", "Control", "ctrl"),
    modifierKey("Alt", "Alt", "alt"),
    arrowKey("←", "Left", "D"),
    arrowKey("↓", "Down", "B"),
    arrowKey("↑", "Up", "A"),
    arrowKey("→", "Right", "C")
  );

  return (data: string) => {
    if (down.size === 0) return data;
    // A character from the keyboard. Longer input, such as a word the keyboard
    // completed, goes through as it is.
    let typed = data;
    if (data.length === 1) {
      if (down.has("shift")) typed = typed.toUpperCase();
      if (down.has("ctrl")) typed = withCtrl(typed);
      typed = alt(typed);
    }
    release();
    return typed;
  };
}
