import "./plain.css";
import { byId } from "@/dom.ts";

/** Show the boot button; pressing it hides the plain page and calls `onBoot`. */
export function showBootMenu(onBoot: () => void) {
  byId("menu").hidden = false;
  byId("boot").addEventListener("click", () => {
    byId("plain").hidden = true;
    onBoot();
  });
}
