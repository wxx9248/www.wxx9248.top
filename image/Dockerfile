# Root filesystem for the in-browser VM. v86 emulates a 32-bit CPU, hence i386.
# Tracks the latest Alpine release; build.sh pulls it and reinstalls packages.
ARG ALPINE=docker.io/i386/alpine:latest

FROM $ALPINE AS tools
RUN apk add --no-cache gcc musl-dev linux-headers
COPY reseed-rng.c /src/
RUN gcc -static -Os -s -o /reseed-rng /src/reseed-rng.c

FROM $ALPINE

ARG KERNEL=virt

RUN apk add --no-cache \
        openrc alpine-base agetty linux-$KERNEL linux-firmware-none \
        bash bash-completion less lowdown vim gnupg fastfetch htop doas \
        ncurses-terminfo-base tzdata musl-locales

RUN adduser -D -u 1000 -s /bin/bash -h /home/visitor -G users visitor \
 && addgroup visitor dialout \
 && passwd -d visitor && passwd -d root \
 && echo 'permit nopass visitor' > /etc/doas.d/visitor.conf

COPY overlay/ /
COPY --from=tools /reseed-rng /usr/local/sbin/

RUN chmod 0755 /usr/local/bin/* /usr/local/sbin/* /etc/init.d/hostagent /etc/local.d/*.start \
 && chmod -R a+rX,go-w /wxx9248 \
 && for s in devfs dmesg mdev; do rc-update add $s sysinit; done \
 && for s in modules sysctl hostname bootmisc localmount; do rc-update add $s boot; done \
 && rc-update add local default && rc-update add hostagent default \
 && rc-update add killprocs shutdown \
 && ln -sf /usr/share/zoneinfo/UTC /etc/localtime \
 && mkinitfs -F "base virtio 9p" $(cat /usr/share/kernel/$KERNEL/kernel.release) \
 && rm -rf /var/cache/apk/* /usr/share/man /usr/share/doc
