import "./base.css";
import { MACHINE_PARAM, getMode } from "./mode.ts";
import { showBootMenu } from "./plain/plain.ts";

// The emulator and terminal are only fetched when this visit boots the machine.
const boot = () => import("./machine/boot.ts").then(({ boot }) => boot());

if (getMode() === "machine") {
  boot();
} else {
  showBootMenu(() => {
    history.replaceState(null, "", `?${MACHINE_PARAM}`);
    boot();
  });
}
