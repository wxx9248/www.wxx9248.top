import "./machine.css";
import { byId } from "@/dom.ts";
import { setMode } from "@/mode.ts";
import { startVM } from "./vm/start.ts";
import type { VM } from "./vm/vm.ts";
import { connectConsole } from "./console.ts";
import { createExtraKeys } from "./extra-keys.ts";
import { connectHostChannel } from "./host-channel.ts";
import { createLinkPreview } from "./link-preview.ts";
import { openLink, openUrl } from "./open-url.ts";
import { showSplash } from "./splash.ts";
import { createTerminal } from "./terminal.ts";
import { syncTitle } from "./title.ts";
import { showToast } from "./toast.ts";
import { isTouchScreen } from "./touch-screen.ts";
import { enableTouchScroll } from "./touch-scroll.ts";
import { followVisualViewport } from "./viewport.ts";

/** Switch the page to machine mode and resume the VM in the terminal. */
export async function boot() {
  setMode("machine");
  const machine = byId("machine");
  machine.hidden = false;
  followVisualViewport(machine);
  const preview = createLinkPreview(byId("link-preview"));
  const term = await createTerminal(byId("terminal"), {
    open: openLink,
    hover: preview.show,
    leave: preview.hide
  });
  enableTouchScroll(term, byId("terminal"));
  const filter = createExtraKeys(byId("extra-keys"), term);
  if (import.meta.env.DEV) Object.assign(window, { term });

  const splash = showSplash(term);
  let vm: VM;
  try {
    vm = await startVM(splash.progress);
  } catch (error) {
    splash.fail(error);
    return;
  }

  connectConsole(term, vm, filter);
  syncTitle(term);
  const channel = connectHostChannel(vm, { open: openUrl });
  term.onResize(({ rows, cols }) => channel.resize(rows, cols));
  channel.resize(term.rows, term.cols);
  channel.resume();
  term.focus();
  // A phone only opens its keyboard for a tap, not for focus() after a download.
  if (isTouchScreen())
    showToast(document.createTextNode("Tap the terminal to type."));
}
