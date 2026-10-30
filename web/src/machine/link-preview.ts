import { linkTarget } from "./open-url.ts";

/**
 * Show where the link under the mouse leads, as a browser's status bubble
 * does. A hyperlink the guest prints (OSC 8) can show one address and lead to
 * another. Links that go nowhere (see linkTarget) show nothing.
 */
export function createLinkPreview(element: HTMLElement) {
  return {
    show(target: string) {
      const url = linkTarget(target);
      if (!url) return;
      element.textContent = url;
      element.hidden = false;
    },
    hide() {
      element.hidden = true;
    }
  };
}
