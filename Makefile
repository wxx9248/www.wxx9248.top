# Build pipeline: guest rootfs -> booted snapshot -> static site.
.PHONY: all image state web dev preview deploy check clean icons fonts

all: web

# BIOS images and rootfs tools from the commit of the installed v86 package.
build/v86/COMMIT: pnpm-lock.yaml tools/fetch-v86.mjs
	node tools/fetch-v86.mjs

# A file's timestamp shows when its contents change. What timestamps miss (a
# file added, removed or renamed, a symlink retargeted, a mode changed) shows
# in this listing of image/overlay, rewritten only when it changes.
OVERLAY_LIST := build/overlay.list
$(shell mkdir -p build && find image/overlay -printf '%P %y %m %l\n' | LC_ALL=C sort > $(OVERLAY_LIST).new \
    && { cmp -s $(OVERLAY_LIST).new $(OVERLAY_LIST) && rm $(OVERLAY_LIST).new || mv $(OVERLAY_LIST).new $(OVERLAY_LIST); })

image: build/image/fs.json
build/image/fs.json: build/v86/COMMIT image/Dockerfile image/build.sh image/patch-rootfs-tar.py image/reseed-rng.c \
    $(OVERLAY_LIST) $(shell find image/overlay -type f)
	./image/build.sh

state: build/state/manifest.json
# Snapshots only restore on the v86 build and BIOS that saved them.
build/state/manifest.json: build/image/fs.json tools/build-state.mjs web/src/machine/vm/config.ts build/v86/COMMIT
	node tools/build-state.mjs

web: build/state/manifest.json build/fonts/fusion-pixel.css
	pnpm build

# Pixel renders of the favicon for clients that don't read SVG icons. They're
# committed, so building the site doesn't need ImageMagick. The icon is drawn on
# a 16px grid: render it at 16px and scale by whole pixels to keep it crisp. The
# icon has 4 colours, so a palette keeps the ICO small (2.7 KB, not 15 KB).
icons: web/public/favicon.ico web/public/apple-touch-icon.png
web/public/favicon.ico: web/public/favicon.svg
	magick -background none $< -filter point \( -clone 0 -resize 32x32 \) \( -clone 0 -resize 48x48 \) \
	    -type palettealpha $@
# iOS home screen: 180px, so 11 pixels per grid cell plus a 2px border, on the
# page background.
web/public/apple-touch-icon.png: web/public/favicon.svg
	magick -background black $< -filter point -resize 176x176 -gravity center -extent 180x180 \
	    -strip -define png:exclude-chunks=date,time $@

# Departure Mono, and Fusion Pixel's CJK characters split into files the
# browser fetches as text needs them.
fonts: build/fonts/fusion-pixel.css
build/fonts/fusion-pixel.css: tools/build-fonts.py uv.lock
	uv run tools/build-fonts.py

dev: build/state/manifest.json build/fonts/fusion-pixel.css
	pnpm dev

preview: web
	pnpm preview

# Workers static assets allow 20,000 files per version (free plan) and 25 MiB
# per file.
check: web
	@n=$$(find web/dist -type f | wc -l); echo "$$n files"; test $$n -lt 20000
	@big=$$(find web/dist -type f -size +25M); test -z "$$big" || { echo "too large: $$big"; exit 1; }

deploy: check
	pnpm exec wrangler deploy

clean:
	rm -rf build web/dist
