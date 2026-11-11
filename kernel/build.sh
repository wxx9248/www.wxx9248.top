#!/usr/bin/env bash
# Build the guest kernel: tinyconfig plus our option files in config/, in a
# container.
#   kernel/build.sh <release|debug>
# Output in build/kernel/<build>/: bzImage, vmlinux, .config, System.map, and
# inputs.sha256, which lets a later run skip the build when nothing changed.
set -euo pipefail

KERNEL_VERSION=6.18.62
KERNEL_SHA256=490a7aedf1b355c565d3a6c05333ccccb5da82064eca46b590448a7099d7d651

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUILD="${1:-}"
case "$BUILD" in
    release | debug) ;;
    *) echo "usage: kernel/build.sh <release|debug>" >&2; exit 2 ;;
esac
SRC="$ROOT/build/kernel/src"
TREE="$SRC/linux-$KERNEL_VERSION"
OUT="$ROOT/build/kernel/$BUILD"
IMAGE_NAME=wxx9248/homepage-kernel

# One kernel build at a time: release and debug share the source tree, which a
# build replaces when the patches change.
mkdir -p "$ROOT/build/kernel"
exec 9>"$ROOT/build/kernel/build.lock"
if ! flock --nonblock 9; then
    echo "kernel: another build is running" >&2
    exit 1
fi

# Our changes to the kernel source, applied in name order with patch -p1.
shopt -s nullglob
PATCHES=("$ROOT"/kernel/patches/*.patch)
shopt -u nullglob
# Their contents in order, not their names: renaming a patch without changing
# the order changes nothing, as for the CI cache key's hashFiles.
patch_hash=$(for p in "${PATCHES[@]}"; do cat "$p"; done | sha256sum | cut -d' ' -f1)

# The build depends on these files, the patches, the version and the build
# name; the CI cache key in deploy.yml names the same files. Comparing a hash
# instead of timestamps keeps a kernel restored from the CI cache, whose inputs
# actions/checkout has just rewritten.
hash=$( (cd "$ROOT/kernel" && cat Dockerfile build.sh scripts/check-config.py config/base.config "config/$BUILD.config"
         echo "$KERNEL_VERSION $BUILD $patch_hash") | sha256sum | cut -d' ' -f1)
if [[ -f "$OUT/inputs.sha256" && "$(cat "$OUT/inputs.sha256")" == "$hash" ]]; then
    echo "kernel $BUILD: up to date"
    exit 0
fi
# Written again only once every output is in place, so an interrupted build
# never looks finished.
rm -f "$OUT/inputs.sha256"

# The tree records the patches applied to it. Patches can't be taken back out
# reliably, so a tree with other patches is replaced by a fresh one.
if [[ ! -d "$TREE" || "$(cat "$TREE.patches" 2>/dev/null)" != "$patch_hash" ]]; then
    rm -rf "$TREE" "$TREE.patches"
    mkdir -p "$SRC"
    tarball="$SRC/linux-$KERNEL_VERSION.tar.xz"
    if [[ ! -f "$tarball" ]]; then
        curl -fsSL --retry 3 -o "$tarball.part" \
            "https://cdn.kernel.org/pub/linux/kernel/v${KERNEL_VERSION%%.*}.x/linux-$KERNEL_VERSION.tar.xz"
        if ! echo "$KERNEL_SHA256  $tarball.part" | sha256sum -c --quiet - >/dev/null 2>&1; then
            rm -f "$tarball.part"
            echo "kernel: linux-$KERNEL_VERSION.tar.xz: SHA-256 mismatch" >&2
            exit 1
        fi
        mv "$tarball.part" "$tarball"
    fi
    # Extract and patch beside the tree, then rename, so a half-extracted or
    # half-patched tree is never used. The record is written last.
    rm -rf "$SRC/.extract" && mkdir "$SRC/.extract"
    tar -xf "$tarball" -C "$SRC/.extract"
    for p in "${PATCHES[@]}"; do
        echo "kernel: applying $(basename "$p")"
        # --fuzz=0: every context line must match, or the hunk fails. A hunk
        # whose lines moved still applies; patch reports the offset, and a
        # patch with offsets is worth refreshing. No .orig backups in the tree.
        if ! patch -d "$SRC/.extract/linux-$KERNEL_VERSION" -p1 --forward --batch --fuzz=0 \
                --no-backup-if-mismatch <"$p"; then
            echo "kernel: $(basename "$p") does not apply" >&2
            exit 1
        fi
    done
    mv "$SRC/.extract/linux-$KERNEL_VERSION" "$TREE"
    rmdir "$SRC/.extract"
    echo "$patch_hash" >"$TREE.patches"
fi

# Object files make rebuilds quick, but a build stopped part-way can leave a
# half-written generated file that make then trusts. Such a build leaves this
# marker behind, and the next one starts from an empty directory. So do objects
# built from another kernel version or other patches: tar restores the
# archive's timestamps, so a file that changed since would look older than its
# object.
obj="$ROOT/build/kernel/obj/$BUILD"
source_id="$KERNEL_VERSION $patch_hash"
if [[ -e "$obj.incomplete" || "$(cat "$obj.patches" 2>/dev/null)" != "$source_id" ]]; then
    rm -rf "$obj"
fi
mkdir -p "$obj"
echo "$source_id" >"$obj.patches"
touch "$obj.incomplete"

# No build context: the Dockerfile copies nothing in.
docker build --quiet --tag "$IMAGE_NAME" - <"$ROOT/kernel/Dockerfile" >/dev/null
# merge_config.sh -n applies the files with allnoconfig, as tinyconfig itself
# does, so an option our files don't name stays off even when turning on its
# parent makes it visible. check-config.py then catches what kconfig dropped.
# --userns=host: with a daemon that remaps user namespaces, the container's
# user would otherwise not own the mounted build directory. The build user and
# host appear in /proc/version.
# The container is removed whenever this script ends, so a killed build doesn't
# keep compiling into obj/. Waiting in the background lets the traps run as soon
# as a signal arrives.
CONTAINER_NAME="wxx9248-homepage-kernel-$BUILD-$$"
trap 'docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
docker run --rm --name "$CONTAINER_NAME" --userns=host --user "$(id -u):$(id -g)" \
    --volume "$ROOT/build/kernel:/build" --volume "$ROOT/kernel:/kernel:ro" \
    --workdir "/build/src/linux-$KERNEL_VERSION" --env BUILD="$BUILD" --env ARCH=i386 \
    --env KBUILD_BUILD_USER=wxx9248 --env KBUILD_BUILD_HOST=www.wxx9248.top \
    "$IMAGE_NAME" sh -euc '
        obj=/build/obj/$BUILD
        mkdir -p "$obj"
        make O="$obj" tinyconfig >/dev/null
        cp "$obj/.config" "$obj/tinyconfig"
        scripts/kconfig/merge_config.sh -n -O "$obj" \
            "$obj/tinyconfig" /kernel/config/base.config "/kernel/config/$BUILD.config" >"$obj/merge.log"
        python3 /kernel/scripts/check-config.py "$obj/.config" /kernel/config/base.config "/kernel/config/$BUILD.config"
        make O="$obj" -j"$(nproc)" bzImage
        size "$obj/vmlinux"
    ' &
wait $!

rm "$obj.incomplete"
mkdir -p "$OUT"
cp "$obj/arch/x86/boot/bzImage" "$obj/vmlinux" "$obj/.config" "$obj/System.map" "$OUT/"
echo "bzImage: $(stat -c %s "$OUT/bzImage") bytes"
echo "$hash" > "$OUT/inputs.sha256"
