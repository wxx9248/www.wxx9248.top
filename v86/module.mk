# v86: BIOS images and rootfs tools from the commit of the installed v86 npm
# package, in build/v86/.
#
# Publishes:
#   V86_COMMIT  build/v86/COMMIT, written last by v86/fetch.mjs: "fetch complete"

V86_COMMIT := build/v86/COMMIT

.PHONY: v86
v86: $(V86_COMMIT)

$(V86_COMMIT): pnpm-lock.yaml v86/fetch.mjs
	node v86/fetch.mjs
