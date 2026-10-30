// The deployed site's URL layout and the element IDs that tie index.html to the
// code. Shared by the page and the Vite config. public/_headers cannot import
// this file, so it repeats the URL prefixes; keep them in sync.

/** The guest's root filesystem: one content-addressed file per inode. */
export const VM_FLAT_URL = "/vm/flat/";
/** The snapshot parts listed in the manifest. */
export const VM_STATE_URL = "/vm/state/";
/**
 * Public keys. keys.md links to them as keys/…, relative to the page at /, both
 * on the plain page and in the terminal (see openLink).
 */
export const KEYS_URL = "/keys/";
/** The fonts' licences, from tools/build-fonts.py. */
export const FONT_LICENSES_URL = "/fonts/";

/** The inline <script type="application/json"> holding the snapshot manifest. */
export const SNAPSHOT_MANIFEST_ID = "snapshot-manifest";
