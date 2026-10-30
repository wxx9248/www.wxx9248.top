import type { Terminal } from "@xterm/xterm";

/** The guest is untrusted and could send a title that fills the tab bar. */
const MAX_TITLE_LENGTH = 80;

/** Show the guest's terminal title in the tab, followed by the site's title. */
export function syncTitle(term: Terminal) {
  const siteTitle = document.title;
  term.onTitleChange((title) => {
    // By code point, so a cut never splits a character.
    const shown = [...title.trim()].slice(0, MAX_TITLE_LENGTH).join("");
    document.title = shown ? `${shown} – ${siteTitle}` : siteTitle;
  });
}
