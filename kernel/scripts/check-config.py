#!/usr/bin/env python3
"""Check that every option the fragments ask for made it into the .config.

kconfig drops an option whose dependencies aren't met, and merge_config.sh only
warns about it, in output that's easy to miss. This turns it into an error.

Usage: check-config.py <generated .config> <fragment>...   (fragments in merge order)
"""

import re
import sys
from pathlib import Path

SET = re.compile(r"^CONFIG_(\w+)=(.*)$")
NOT_SET = re.compile(r"^# CONFIG_(\w+) is not set$")


def read_config(path: Path) -> dict[str, str]:
    """Options in a .config or fragment; "is not set" reads as "n"."""
    options = {}
    for line in Path(path).read_text().splitlines():
        if m := SET.match(line):
            options[m[1]] = m[2]
        elif m := NOT_SET.match(line):
            options[m[1]] = "n"
    return options


def requested(paths: list[Path]) -> dict[str, str]:
    """What the fragments ask for together; a later fragment wins."""
    options = {}
    for path in paths:
        options |= read_config(path)
    return options


def mismatches(want: dict[str, str], got: dict[str, str]) -> list[str]:
    """One line per requested option the .config doesn't have; absent means n."""
    return [
        f"CONFIG_{name}: requested {value}, got {got.get(name, 'n')} (probably an unmet dependency)"
        for name, value in sorted(want.items())
        if got.get(name, "n") != value
    ]


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print(__doc__.strip().splitlines()[-1], file=sys.stderr)
        return 2
    config, *fragments = map(Path, argv)
    problems = mismatches(requested(fragments), read_config(config))
    for line in problems:
        print(line, file=sys.stderr)
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
