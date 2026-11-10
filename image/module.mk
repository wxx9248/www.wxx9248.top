# Image: the guest root filesystem, built by image/build.sh into build/image/.
#
# Publishes:
#   IMAGE_FS_JSON  build/image/fs.json, the 9p metadata. image/build.sh writes it
#                  before flat/, so it doesn't prove that a build finished.

IMAGE_FS_JSON := build/image/fs.json

.PHONY: image
image: $(IMAGE_FS_JSON)

# A file's timestamp shows when its contents change. What timestamps miss (a
# file added, removed or renamed, a symlink retargeted, a mode changed) shows
# in the stamped listing of image/overlay, build/overlay.list.
$(IMAGE_FS_JSON): $(V86_COMMIT) image/Dockerfile image/build.sh image/patch-rootfs-tar.py image/reseed-rng.c \
    $(shell find image/overlay -type f) \
    $$(call stamp,build/overlay.list,find image/overlay -printf '%P %y %m %l\n' | LC_ALL=C sort)
	./image/build.sh
