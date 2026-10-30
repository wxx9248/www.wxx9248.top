// Machine configuration shared by the snapshot builder and the page. A snapshot
// only restores into a machine configured exactly like the one that saved it.
// tools/build-state.mjs loads this file in Node, which doesn't know the @/ alias.

export const MEMORY_SIZE = 128 * 1024 * 1024;
export const VGA_MEMORY_SIZE = 2 * 1024 * 1024;
// v86 adds an NE2000 network card unless told otherwise. It has no "none" type,
// but a type it doesn't recognize leaves the machine without a network card.
export const NET_DEVICE = { type: "none" };

export const CMDLINE = [
  "ro root=host9p rootfstype=9p rootflags=trans=virtio,cache=loose",
  "modules=virtio_pci tsc=reliable init_on_free=on mitigations=off",
  "console=ttyS0 quiet"
].join(" ");
