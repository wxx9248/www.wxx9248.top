# Fonts: Departure Mono, and Fusion Pixel's CJK characters split into files the
# browser fetches as text needs them, built by fonts/build.py into build/fonts/.
#
# Publishes:
#   FONTS_CSS  build/fonts/fusion-pixel.css, written last: "build complete"

FONTS_CSS := build/fonts/fusion-pixel.css

.PHONY: fonts
fonts: $(FONTS_CSS)

$(FONTS_CSS): fonts/build.py uv.lock
	uv run fonts/build.py
