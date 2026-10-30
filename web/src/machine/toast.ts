import { byId } from "@/dom.ts";

const DURATION_MS = 8000;
let timer: ReturnType<typeof setTimeout> | undefined;

/** Show a short message over the terminal; a new one replaces the last. */
export function showToast(content: Node) {
  const toast = byId("toast");
  toast.replaceChildren(content);
  toast.hidden = false;
  clearTimeout(timer);
  timer = setTimeout(() => (toast.hidden = true), DURATION_MS);
}
