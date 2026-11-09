# Kernel: the guest kernel, built by kernel/build.sh into build/kernel/<build>/.
#
# Publishes:
#   KERNEL           which build: release (deployed, the default) or debug
#   KERNEL_BZIMAGE   build/kernel/$(KERNEL)/bzImage
#   KERNEL_SELECTED  records $(KERNEL), rewritten only when it changes, so
#                    switching back to release rebuilds a snapshot made with
#                    the debug kernel

KERNEL ?= release
KERNEL_BZIMAGE := build/kernel/$(KERNEL)/bzImage
KERNEL_SELECTED := build/kernel/selected

.PHONY: kernel
kernel: $(KERNEL_BZIMAGE)

# kernel/build.sh decides whether to rebuild by hashing its inputs: after
# actions/checkout every file is newer than a kernel restored from the cache.
# It leaves the bzImage untouched when nothing changed.
$(KERNEL_BZIMAGE): FORCE
	./kernel/build.sh $(KERNEL)

# Runs whenever the snapshot is considered, even under make -n (the +), but
# changes the file only when the choice changes.
$(KERNEL_SELECTED): FORCE
	+@mkdir -p $(@D) && echo $(KERNEL) > $@.new
	+@cmp -s $@.new $@ && rm $@.new || mv $@.new $@
