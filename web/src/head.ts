// Runs inline in <head> before first paint (see plugins/inline-script.ts):
// decides whether this visit boots the machine or shows the plain page, and
// when it boots, starts downloading the snapshot right away.

import { MACHINE_PARAM, PLAIN_PARAM, setMode, type Mode } from "./mode.ts";
import { VM_STATE_URL } from "./site.ts";
import { readManifest } from "./machine/vm/snapshot.ts";

// Phones and touch screens get the plain page unless they ask for the machine.
const SMALL_SCREEN = "(max-width: 700px), (pointer: coarse)";

const query = new URLSearchParams(location.search);
const small = matchMedia(SMALL_SCREEN).matches;
const mode: Mode =
  query.has(MACHINE_PARAM) || (!query.has(PLAIN_PARAM) && !small)
    ? "machine"
    : "plain";
setMode(mode);

if (mode === "machine") {
  for (const part of readManifest().parts) {
    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "fetch";
    // Must match fetchSnapshot()'s request, or the browser downloads it twice.
    link.crossOrigin = "anonymous";
    link.href = VM_STATE_URL + part;
    document.head.append(link);
  }
}
