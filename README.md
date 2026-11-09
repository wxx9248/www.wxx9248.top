# www.wxx9248.top

## Layout

| Path | What it is |
|---|---|
| `image/overlay/wxx9248/` | Public files: bio, links, keys. The single source for the VM's `/wxx9248` and the plain page. |
| `image/` | Guest root filesystem: `Dockerfile`, `overlay/` (copied over `/`: init, fstab, helpers, host agent, `/wxx9248`), `build.sh`, `patch-rootfs-tar.py` (replaces the files Docker manages in the exported image), and `reseed-rng.c` (forces the kernel to reseed its RNG after a restore) |
| `kernel/` | The guest kernel: `build.sh` builds it in a container (`Dockerfile`) from tinyconfig plus `base.config` and `release.config` or `debug.config`; `check-config.py` fails the build when kconfig drops a requested option; `compare-config.py` lists what Alpine's kernel has that ours doesn't, for review on version bumps |
| `snapshot/` | `build.mjs` boots the guest headlessly and saves the snapshot that visitors restore; `bench.mjs` restores it headlessly and times the load, the resume and shell workloads, to compare kernel builds |
| `v86/` | `fetch.mjs` fetches v86's BIOS images and rootfs tools from the commit of the installed npm package, so `package.json` is the only place v86's version lives |
| `fonts/` | `build.py` fetches Departure Mono and Fusion Pixel from their pinned releases and splits Fusion Pixel into per-range files; the script is the only place their versions live |
| `web/` | Vite + TypeScript page. `404.html`: what Cloudflare serves for unknown paths, in the plain page's style; `src/plain/`: the plain page (markup, styles, boot button); `src/machine/`: the booted machine: terminal (xterm.js), host channel, touch support (extra keys, swipe scrolling, keyboard-aware sizing), and in `vm/` the emulator seam (`vm.ts` interface, `start.ts` v86 implementation, `config.ts` shared with the snapshot build); `plugins/`: Vite plugins for the files under `build/`, snapshot manifest, plain page, `@build/` paths in HTML, and the security headers in `_headers`; `colors.mjs`: checks the files that repeat the colour tokens |

## How it works

- **Root filesystem:** a read-only 9p mount. Each file is a zstd blob named by its hash, fetched the first time the guest opens it. `/home/visitor`, `/tmp` and friends are tmpfs.
- **Kernel:** Linux built for v86 and nothing else: tinyconfig plus the options in `kernel/`, with no modules and no initramfs. v86 boots the `bzImage` directly, and the kernel mounts the 9p root itself. A debug build adds symbols, frame pointers and SysRq.
- **Boot:** visitors don't boot. They restore a snapshot of a machine that has already booted and logged in. Before saving it, the build drops caches and zero-fills free RAM so it compresses well.
- **Host channel:** `/dev/ttyS1` carries a line protocol between the guest's `hostagent` and the page. `resize`/`resume` go to the guest; `open <url>` comes back from it.
- **Fonts:** everything is set in [Departure Mono](https://departuremono.com), with CJK characters from the Simplified Chinese build of [Fusion Pixel Font](https://github.com/TakWolf/fusion-pixel-font) (12px monospaced), both OFL. All of Fusion Pixel's language builds have the same characters, so one build serves Chinese, Japanese and Korean; Han characters take their mainland Chinese shapes. `make fonts` (`fonts/build.py`, part of every build) fetches both fonts' releases named in the script, checks their hashes, and splits Fusion Pixel into 24 files of about 40 KB with their `@font-face` rules, all in `build/fonts/`. The page imports the fonts from there, so Vite fingerprints them and they are cached as immutable; their licences are served at `/fonts/`. A browser only downloads the files for characters it shows: the plain page needs just the 8 KB kana file.
- **Colours:** every colour is a semantic token of [@wxx9248/colors](https://github.com/wxx9248/colors), shared with wxx9248's other sites. The page uses its `--color-*` properties, and the terminal's theme takes the `terminal-*` tokens from the package's JS API. The site is dark only, so `base.css` pins `color-scheme: dark`. The theme-color meta tags, `favicon.svg` and `apple-touch-icon.png` can't import the tokens, so `make check` runs `web/colors.mjs check` to compare them. pnpm's minimum release age doesn't apply to `@wxx9248/*` (`pnpm-workspace.yaml`), so a new palette can be used as soon as it's published.
- **Icons:** `web/public/favicon.svg` is the source. `make icons` (ImageMagick) renders `favicon.ico` (16, 32 and 48px) and `apple-touch-icon.png` (180px, on the page background) next to it, for clients that don't read SVG icons. The renders are committed, so building the site doesn't need ImageMagick.

## Build

Requires Docker (with `linux/386`), Node (the version in `devEngines` in `package.json`), pnpm, [uv](https://docs.astral.sh/uv/) (it provides the Python in `.python-version` and the packages in `pyproject.toml`), and network access to GitHub for `v86/fetch.mjs` and to kernel.org for `kernel/build.sh`. Docker also runs the kernel build, on an x86_64 host.

```sh
pnpm install
make image    # build/image: rootfs.tar, fs.json, flat/
make kernel   # build/kernel/release: bzImage, vmlinux, .config, System.map
make snapshot # build/snapshot: snapshot parts + manifest
make KERNEL=debug snapshot  # the same with the debug kernel
make bench LABEL=<name>  # build/bench/<name>.json; compare with node snapshot/bench.mjs --compare
make dev      # http://localhost:5173 (?plain / ?machine force a mode)
make preview  # production build in wrangler dev: Cloudflare's headers and 404 page
make check    # production build, colour copies, Cloudflare static asset limits
make deploy   # wrangler deploy (Worker config in wrangler.jsonc)
make icons    # favicon.ico and apple-touch-icon.png from favicon.svg
make fonts    # build/fonts: Departure Mono, and Fusion Pixel split into per-range files
pnpm format   # Prettier for JS/TS (pnpm format:check to verify)
```

Changing anything under `image/` requires `make image snapshot` again, and under `kernel/`, `make snapshot`; `make deploy` does both for you. `uv run python -m unittest discover -s kernel` runs the kernel scripts' tests.

