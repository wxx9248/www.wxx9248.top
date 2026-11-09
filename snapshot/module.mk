# Snapshot: the guest booted once and saved, which visitors restore instead of
# booting. snapshot/build.mjs writes it to build/snapshot/.
#
# Publishes:
#   SNAPSHOT_MANIFEST  build/snapshot/manifest.json, the part list, written last

SNAPSHOT_MANIFEST := build/snapshot/manifest.json

.PHONY: snapshot bench
snapshot: $(SNAPSHOT_MANIFEST)

# Snapshots only restore on the v86 build and BIOS that saved them.
$(SNAPSHOT_MANIFEST): $(IMAGE_FS_JSON) snapshot/build.mjs web/src/machine/vm/config.ts $(V86_COMMIT) \
    $(KERNEL_BZIMAGE) $(KERNEL_SELECTED)
	node snapshot/build.mjs $(KERNEL_BZIMAGE)

# Times the snapshot currently built: load, resume and shell workloads.
# LABEL names the result, build/bench/$(LABEL).json; compare results with
# node snapshot/bench.mjs --compare.
bench: $(SNAPSHOT_MANIFEST)
	node snapshot/bench.mjs --label $(LABEL)
