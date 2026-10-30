# www.wxx9248.top

## Layout

| Path | What it is |
|---|---|
| `image/overlay/wxx9248/` | Public files: bio, links, keys. The single source for the VM's `/wxx9248` and the plain page. |
| `image/` | Guest root filesystem: `Dockerfile`, `overlay/` (copied over `/`: init, fstab, helpers, host agent, `/wxx9248`), `build.sh`, `patch-rootfs-tar.py` (replaces the files Docker manages in the exported image), and `reseed-rng.c` (forces the kernel to reseed its RNG after a restore) |
| `tools/build-state.mjs` | Boots the guest headlessly and saves the snapshot that visitors restore |
| `tools/fetch-v86.mjs` | Fetches v86's BIOS images and rootfs tools from the commit of the installed npm package, so `package.json` is the only place v86's version lives |
| `tools/build-fonts.py` | Fetches Departure Mono and Fusion Pixel from their pinned releases and splits Fusion Pixel into per-range files; the script is the only place their versions live |
| `web/` | Vite + TypeScript page. `404.html`: what Cloudflare serves for unknown paths, in the plain page's style; `src/plain/`: the plain page (markup, styles, boot button); `src/machine/`: the booted machine: terminal (xterm.js), host channel, touch support (extra keys, swipe scrolling, keyboard-aware sizing), and in `vm/` the emulator seam (`vm.ts` interface, `start.ts` v86 implementation, `config.ts` shared with the snapshot build); `plugins/`: Vite plugins for the files under `build/`, snapshot manifest, plain page, `@build/` paths in HTML, and the security headers in `_headers` |

## How it works

- **Root filesystem:** a read-only 9p mount. Each file is a zstd blob named by its hash, fetched the first time the guest opens it. `/home/visitor`, `/tmp` and friends are tmpfs.
- **Boot:** visitors don't boot. They restore a snapshot of a machine that has already booted and logged in. Before saving it, the build drops caches and zero-fills free RAM so it compresses well.
- **Host channel:** `/dev/ttyS1` carries a line protocol between the guest's `hostagent` and the page. `resize`/`resume` go to the guest; `open <url>` comes back from it.
- **Fonts:** everything is set in [Departure Mono](https://departuremono.com), with CJK characters from the Simplified Chinese build of [Fusion Pixel Font](https://github.com/TakWolf/fusion-pixel-font) (12px monospaced), both OFL. All of Fusion Pixel's language builds have the same characters, so one build serves Chinese, Japanese and Korean; Han characters take their mainland Chinese shapes. `make fonts` (`tools/build-fonts.py`, part of every build) fetches both fonts' releases named in the script, checks their hashes, and splits Fusion Pixel into 24 files of about 40 KB with their `@font-face` rules, all in `build/fonts/`. The page imports the fonts from there, so Vite fingerprints them and they are cached as immutable; their licences are served at `/fonts/`. A browser only downloads the files for characters it shows: the plain page needs just the 8 KB kana file.
- **Icons:** `web/public/favicon.svg` is the source. `make icons` (ImageMagick) renders `favicon.ico` (16, 32 and 48px) and `apple-touch-icon.png` (180px) next to it, for clients that don't read SVG icons. The renders are committed, so building the site doesn't need ImageMagick.

## Build

Requires Docker (with `linux/386`), Node (the version in `devEngines` in `package.json`), pnpm, [uv](https://docs.astral.sh/uv/) (it provides the Python in `.python-version` and the packages in `pyproject.toml`), and network access to GitHub for `tools/fetch-v86.mjs`.

```sh
pnpm install
make image    # build/image: rootfs.tar, fs.json, flat/
make state    # build/state: snapshot parts + manifest
make dev      # http://localhost:5173 (?plain / ?machine force a mode)
make preview  # production build in wrangler dev: Cloudflare's headers and 404 page
make check    # production build + Cloudflare static asset limits
make deploy   # wrangler deploy (Worker config in wrangler.jsonc)
make icons    # favicon.ico and apple-touch-icon.png from favicon.svg
make fonts    # build/fonts: Departure Mono, and Fusion Pixel split into per-range files
pnpm format   # Prettier for JS/TS (pnpm format:check to verify)
```

Changing anything under `image/` requires `make image state` again; `make deploy` does this for you.

