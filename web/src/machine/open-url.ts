import { showToast } from "./toast.ts";

/**
 * The guest's `open` checks this too, but the page must not trust the guest,
 * or the links it prints in the terminal.
 */
const WEB_URL = /^https?:\/\//;
const MAIL_URL = /^mailto:/;

/**
 * Open an http(s) URL from the guest in a new tab, or offer it as a link.
 * A mailto: URL goes to the visitor's mail app. Anything else is ignored.
 */
export function openUrl(url: string) {
  if (MAIL_URL.test(url)) {
    // Clicking a link hands it to the mail app; window.open would leave an
    // empty tab behind.
    const link = document.createElement("a");
    link.href = url;
    link.click();
    return;
  }
  if (!WEB_URL.test(url)) return;
  // Typing the command or clicking the link gave the page transient user
  // activation, which is usually enough for a popup. If the browser blocks it
  // anyway, offer the link instead.
  // ("noopener" would make window.open return null even on success.)
  const tab = window.open(url, "_blank");
  if (tab) {
    tab.opener = null;
    return;
  }
  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener";
  link.textContent = url;
  const message = document.createElement("span");
  message.append("Your browser blocked the new tab. Open ", link);
  showToast(message);
}

/**
 * Where a link in the terminal leads, or undefined if clicking it does nothing.
 * Like an <a href> on the page, a relative target resolves against the page's
 * URL: keys.md's keys/pgp.asc opens /keys/pgp.asc (see KEYS_URL in site.ts).
 */
export function linkTarget(target: string): string | undefined {
  let url: string;
  try {
    url = new URL(target, location.href).href;
  } catch {
    return undefined;
  }
  return WEB_URL.test(url) || MAIL_URL.test(url) ? url : undefined;
}

/** Open a link clicked in the terminal. */
export function openLink(target: string) {
  const url = linkTarget(target);
  if (url) openUrl(url);
}
