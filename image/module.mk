# Image: the guest root filesystem, built by image/build.sh into build/image/.
#
# Publishes:
#   IMAGE_FS_JSON  build/image/fs.json, the 9p metadata. image/build.sh writes it
#                  before flat/, so it doesn't prove that a build finished.

IMAGE_FS_JSON := build/image/fs.json
_image_overlay_list := build/overlay.list

.PHONY: image
image: $(IMAGE_FS_JSON)

$(IMAGE_FS_JSON): $(V86_COMMIT) image/Dockerfile image/build.sh image/patch-rootfs-tar.py image/reseed-rng.c \
    $(_image_overlay_list) $(shell find image/overlay -type f)
	./image/build.sh

# A file's timestamp shows when its contents change. What timestamps miss (a
# file added, removed or renamed, a symlink retargeted, a mode changed) shows
# in this listing of image/overlay. It runs whenever the image is considered,
# even under make -n (the +), but changes the file only when the listing does.
$(_image_overlay_list): FORCE
	+@mkdir -p $(@D) && find image/overlay -printf '%P %y %m %l\n' | LC_ALL=C sort > $@.new
	+@cmp -s $@.new $@ && rm $@.new || mv $@.new $@
