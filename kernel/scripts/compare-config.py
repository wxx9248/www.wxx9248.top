#!/usr/bin/env python3
"""List options Alpine's kernel enables that ours leaves off, for review.

Run it when bumping KERNEL_VERSION, to spot new options worth adding to
base.config. It reads the Kconfig files directly and counts only options with a
prompt, since the others follow from those.

Usage: compare-config.py <kernel source tree> <our .config> <Alpine's config>

  curl -fsSLO https://gitlab.alpinelinux.org/alpine/aports/-/raw/master/main/linux-lts/virt.x86.config
  kernel/scripts/compare-config.py build/kernel/src/linux-<version> build/kernel/release/.config virt.x86.config
"""

import importlib.util
import os
import re
import sys
from collections import defaultdict
from pathlib import Path

spec = importlib.util.spec_from_file_location(
    "check_config", Path(__file__).with_name("check-config.py")
)
check_config = importlib.util.module_from_spec(spec)
spec.loader.exec_module(check_config)
read_config = check_config.read_config

SYMBOL = re.compile(r"^\s*(?:menu)?config\s+(\w+)\s*$")
PROMPT = re.compile(r'^\s*(?:bool|tristate|prompt)\s+"([^"]*)"')
# Lines that end the current symbol's block.
BLOCK_END = re.compile(r"^\s*(menu|endmenu|choice|endchoice|if|endif|source|comment|mainmenu)\b")
SKIPPED = ("Documentation", "tools", "scripts", "samples")


def kconfig_symbols(srctree: Path) -> dict[str, tuple[str, str | None]]:
    """Each symbol's Kconfig file, relative to srctree, and its prompt or None."""
    symbols = {}
    for root, dirs, files in os.walk(srctree):
        rel = Path(root).relative_to(srctree).as_posix()
        if rel.startswith(SKIPPED) or (rel.startswith("arch/") and not rel.startswith("arch/x86")):
            dirs[:] = []
            continue
        for name in sorted(files):
            if not name.startswith("Kconfig"):
                continue
            path = Path(root, name)
            file = path.relative_to(srctree).as_posix()
            current = None
            for line in path.read_text(errors="replace").splitlines():
                if m := SYMBOL.match(line):
                    current = m[1]
                    symbols.setdefault(current, (file, None))
                elif BLOCK_END.match(line):
                    current = None
                elif current and (m := PROMPT.match(line)) and symbols[current][1] is None:
                    symbols[current] = (symbols[current][0], m[1])
    return symbols


def group(path: str) -> str:
    """The source area a Kconfig file belongs to, e.g. drivers/net."""
    parts = Path(path).parent.as_posix().split("/")
    if parts[0] in ("drivers", "net", "fs", "sound", "security", "crypto"):
        return "/".join(parts[:2])
    if parts[0] == "arch":
        return "/".join(parts[:3])
    return parts[0]


def main(argv: list[str]) -> int:
    if len(argv) != 3:
        print(__doc__.split("\n\n")[2].splitlines()[0], file=sys.stderr)
        return 2
    srctree, ours, alpine = map(Path, argv)
    symbols = kconfig_symbols(srctree)
    our_options, alpine_options = read_config(ours), read_config(alpine)
    missing = defaultdict(list)
    for name, value in alpine_options.items():
        file, prompt = symbols.get(name, (None, None))
        if value in ("y", "m") and prompt and our_options.get(name, "n") == "n":
            missing[group(file)].append((name, prompt))
    for area in sorted(missing):
        print(area)
        for name, prompt in sorted(missing[area]):
            print(f"  CONFIG_{name}  {prompt}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
