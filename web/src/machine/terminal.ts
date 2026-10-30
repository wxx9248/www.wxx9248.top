import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { WebglAddon } from "@xterm/addon-webgl";
import "@xterm/xterm/css/xterm.css";
import { isTouchScreen } from "./touch-screen.ts";

const FONT = "Departure Mono";
/** CJK characters, which Departure Mono lacks (see base.css). */
const CJK_FONT = "Fusion Pixel";
// Departure Mono is drawn on an 11px grid; only multiples of half a cell stay
// crisp, and 16.5px only on 2x screens. 22px fits 80 columns on a laptop too,
// but at four times a phone's size, it looked oversized there.
const FONT_SIZES = [16.5, 11];
const MIN_COLS = 80;
const SCROLLBACK_LINES = 5000;
/** Hex alpha appended to the selection colour: 0x66 is 40% opacity. */
const SELECTION_ALPHA = "66";

/** A colour from the design tokens in base.css, as #rrggbb. */
const token = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/** The page's palette, extended to the 16 ANSI colours. */
function theme() {
  const [bg, fg, muted, accent, accentLight, error, link, code] = [
    "--bg",
    "--fg",
    "--muted",
    "--accent",
    "--accent-light",
    "--error",
    "--link",
    "--code"
  ].map(token);
  return {
    background: bg,
    foreground: fg,
    cursor: accent,
    cursorAccent: bg,
    selectionBackground: accent + SELECTION_ALPHA,
    black: bg,
    red: error,
    green: "#7bd88f",
    // md's links.
    yellow: link,
    blue: "#6fa8ff",
    magenta: "#d77bff",
    // The welcome banner, and symlinks such as ~/wxx9248 in ls.
    cyan: accent,
    white: fg,
    brightBlack: muted,
    brightRed: "#ff5a5f",
    brightGreen: "#a4f0b4",
    brightYellow: "#ffe57a",
    // md's inline code.
    brightBlue: code,
    brightMagenta: "#e8adff",
    // md's headings: bold cyan, drawn bright.
    brightCyan: accentLight,
    brightWhite: "#ffffff"
  };
}

/** What happens to links in the terminal's output; each gets the link's target. */
export interface LinkHandlers {
  open(target: string): void;
  hover(target: string): void;
  leave(): void;
}

/** Create a terminal that fills `container` and follows its size. */
export async function createTerminal(
  container: HTMLElement,
  links: LinkHandlers
): Promise<Terminal> {
  // xterm measures its cells once, so the font has to be ready first. The
  // kana file of the CJK font is loaded too, since /wxx9248 has kana in it;
  // the text makes the browser fetch it.
  await Promise.all([
    document.fonts.load(`${FONT_SIZES[0]}px "${FONT}"`),
    document.fonts.load(`${FONT_SIZES[0]}px "${CJK_FONT}"`, "ア")
  ]);
  const term = new Terminal({
    fontFamily: `"${FONT}", "${CJK_FONT}", monospace`,
    fontSize: FONT_SIZES[0],
    lineHeight: 1,
    theme: theme(),
    cursorBlink: true,
    cursorStyle: "block",
    drawBoldTextInBrightColors: true,
    fontWeightBold: "normal",
    scrollback: SCROLLBACK_LINES,
    // Hyperlinks the guest prints (OSC 8), e.g. from md.
    linkHandler: {
      activate: (_event, target) => links.open(target),
      hover: (_event, target) => links.hover(target),
      leave: () => links.leave(),
      // Let relative and mailto: links through; openLink does the filtering.
      allowNonHttpProtocols: true
    }
  });
  const fitAddon = new FitAddon();
  term.loadAddon(fitAddon);
  // Plain URLs in the output.
  term.loadAddon(
    new WebLinksAddon((_event, url) => links.open(url), {
      hover: (_event, url) => links.hover(url),
      leave: () => links.leave()
    })
  );
  term.open(container);
  // In Chromium's phone emulation, the WebGL renderer drew garbage after a
  // resize, which on a phone is every time the keyboard opens or closes. The
  // DOM renderer has no such trouble and is fast enough for a phone-sized
  // terminal.
  if (!isTouchScreen()) {
    try {
      const webgl = new WebglAddon();
      webgl.onContextLoss(() => webgl.dispose());
      term.loadAddon(webgl);
    } catch {
      // The DOM renderer is the fallback.
    }
  }

  const fit = () => {
    // Pick the largest crisp font size that still leaves room for MIN_COLS.
    for (const size of FONT_SIZES) {
      term.options.fontSize = size;
      const dims = fitAddon.proposeDimensions();
      if (dims && dims.cols >= MIN_COLS) break;
    }
    fitAddon.fit();
  };
  fit();
  new ResizeObserver(fit).observe(container);
  document.fonts.addEventListener("loadingdone", () => {
    // The WebGL renderer keeps each glyph it draws. A CJK character drawn
    // before its file arrived is in a fallback font; drop those glyphs.
    term.clearTextureAtlas();
    fit();
  });
  return term;
}
