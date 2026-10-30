#!/usr/bin/env python3
"""Rewrite an exported container tar: drop .dockerenv and replace files that
Docker manages inside containers (hostname, hosts, resolv.conf) with our own.

usage: patch-rootfs-tar.py IN.tar OUT.tar OVERLAY_DIR PATH...
"""
import os
import sys
import tarfile


def main():
    src, dst, overlay, *replace = sys.argv[1:]
    replace = set(replace)
    with tarfile.open(src) as tin, tarfile.open(dst, "w", format=tarfile.PAX_FORMAT) as tout:
        for member in tin:
            name = member.name.removeprefix("./")
            if name == ".dockerenv" or name in replace:
                continue
            tout.addfile(member, tin.extractfile(member) if member.isreg() else None)
        for name in sorted(replace):
            info = tout.gettarinfo(os.path.join(overlay, name), arcname=name)
            info.uid = info.gid = 0
            info.uname = info.gname = "root"
            info.mode = 0o644
            with open(os.path.join(overlay, name), "rb") as f:
                tout.addfile(info, f)


if __name__ == "__main__":
    main()
