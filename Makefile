# Build pipeline: guest rootfs -> booted snapshot -> static site.
#
# Each module's rules are in its own directory's module.mk. Run make from this
# directory: the fragments' paths are relative to it.
.PHONY: all dev preview check deploy clean

all: web

# In dependency order: make expands a rule's prerequisites as it reads the rule,
# so a fragment must come after the fragments whose variables it uses.
include v86/module.mk
include kernel/module.mk
include image/module.mk
include fonts/module.mk
include snapshot/module.mk
include web/module.mk

dev: $(SNAPSHOT_MANIFEST) $(FONTS_CSS)
	pnpm dev

preview: web
	pnpm preview

# Workers static assets allow 20,000 files per version (free plan) and 25 MiB
# per file.
check: web
	@node web/colors.mjs check
	@n=$$(find $(WEB_DIST) -type f | wc -l); echo "$$n files"; test $$n -lt 20000
	@big=$$(find $(WEB_DIST) -type f -size +25M); test -z "$$big" || { echo "too large: $$big"; exit 1; }

deploy: check
	pnpm exec wrangler deploy

clean:
	rm -rf build $(WEB_DIST)

FORCE:
