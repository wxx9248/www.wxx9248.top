#!/usr/bin/env bash
# Build the guest root filesystem and convert it into v86's lazily-loaded 9p format:
#   build/image/rootfs.tar    exported container filesystem
#   build/image/fs.json       9p metadata (only needed to boot without a snapshot)
#   build/image/flat/         one zstd file per inode, named by SHA-256
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
V86="$ROOT/build/v86"  # fetched by tools/fetch-v86.mjs
OUT="$ROOT/build/image"
# Python and its packages come from uv (pyproject.toml).
PYTHON=(uv run --project "$ROOT" python)
IMAGE_NAME=wxx9248/homepage-rootfs
CONTAINER_NAME=wxx9248-homepage-rootfs
# v86 emulates a 32-bit x86 CPU.
PLATFORM=linux/386

mkdir -p "$OUT"
# --pull and --no-cache: always build from the latest Alpine and its current packages.
docker build "$ROOT/image" --platform "$PLATFORM" --tag "$IMAGE_NAME" --pull --no-cache
docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
docker create --platform "$PLATFORM" --name "$CONTAINER_NAME" "$IMAGE_NAME" >/dev/null
docker export "$CONTAINER_NAME" -o "$OUT/export.tar"
docker rm "$CONTAINER_NAME" >/dev/null

# Docker manages these files inside containers, so the exported copies are not
# ours. Replace them with the overlay versions.
"${PYTHON[@]}" "$ROOT/image/patch-rootfs-tar.py" "$OUT/export.tar" "$OUT/rootfs.tar" "$ROOT/image/overlay" \
    etc/hostname etc/hosts etc/resolv.conf
rm "$OUT/export.tar"

"${PYTHON[@]}" "$V86/tools/fs2json.py" --zstd --out "$OUT/fs.json" "$OUT/rootfs.tar"
rm -rf "$OUT/flat" && mkdir -p "$OUT/flat"
"${PYTHON[@]}" "$V86/tools/copy-to-sha256.py" --zstd "$OUT/rootfs.tar" "$OUT/flat" >/dev/null

echo "rootfs: Alpine $(tar -xOf "$OUT/rootfs.tar" etc/alpine-release), $(find "$OUT/flat" -type f | wc -l) files, $(du -sh "$OUT/flat" | cut -f1) compressed"
