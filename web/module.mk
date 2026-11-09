# Web: the site, built by Vite into web/dist/, and the favicon's pixel renders.
#
# Publishes:
#   WEB_DIST  web/dist, the site as deployed

WEB_DIST := web/dist

.PHONY: web icons
web: $(SNAPSHOT_MANIFEST) $(FONTS_CSS)
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
web/public/apple-touch-icon.png: web/public/favicon.svg package.json
	magick -background "$$(node web/colors.mjs get bg-page)" $< -filter point -resize 176x176 -gravity center -extent 180x180 \
	    -strip -define png:exclude-chunks=date,time $@
