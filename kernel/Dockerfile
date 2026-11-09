# Build environment for the guest kernel: Alpine's GCC and binutils, which
# build the i386 kernel with make ARCH=i386. The kernel is freestanding, so no
# 32-bit libc is needed. kernel/build.sh mounts the source and the output.
FROM docker.io/library/alpine:latest

RUN apk add --no-cache build-base flex bison perl bc linux-headers xz python3 coreutils diffutils findutils
