"""Tests for compare-config.py: uv run python -m unittest discover -s kernel"""

import importlib.util
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).with_name("compare-config.py")
spec = importlib.util.spec_from_file_location("compare_config", SCRIPT)
cc = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cc)

FS_KCONFIG = """\
config A
\tbool "Prompt A"
\tdefault y

config HIDDEN
\tbool
\tselect A

menu "Something"
endmenu
"""
NET_KCONFIG = """\
menuconfig NETDRV
\ttristate
\tprompt "Network drivers"
"""
ARM_KCONFIG = 'config ARM_ONLY\n\tbool "ARM thing"\n'


class CompareConfigTest(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.dir.cleanup)
        self.tree = Path(self.dir.name, "linux")
        for path, text in [
            ("fs/Kconfig", FS_KCONFIG),
            ("drivers/net/Kconfig", NET_KCONFIG),
            ("arch/arm/Kconfig", ARM_KCONFIG),
        ]:
            file = self.tree / path
            file.parent.mkdir(parents=True, exist_ok=True)
            file.write_text(text)

    def test_prompted_symbols_found(self):
        symbols = cc.kconfig_symbols(self.tree)
        self.assertEqual(symbols["A"], ("fs/Kconfig", "Prompt A"))
        self.assertEqual(symbols["NETDRV"], ("drivers/net/Kconfig", "Network drivers"))

    def test_promptless_symbol_has_none(self):
        self.assertEqual(cc.kconfig_symbols(self.tree)["HIDDEN"], ("fs/Kconfig", None))

    def test_other_arch_ignored(self):
        self.assertNotIn("ARM_ONLY", cc.kconfig_symbols(self.tree))

    def test_group(self):
        self.assertEqual(cc.group("drivers/net/Kconfig"), "drivers/net")
        self.assertEqual(cc.group("arch/x86/kvm/Kconfig"), "arch/x86/kvm")
        self.assertEqual(cc.group("init/Kconfig"), "init")

    def test_cli_lists_only_enabled_prompted_missing(self):
        ours = Path(self.dir.name, "ours.config")
        ours.write_text("# CONFIG_A is not set\n")
        alpine = Path(self.dir.name, "alpine.config")
        alpine.write_text("CONFIG_A=y\nCONFIG_HIDDEN=y\nCONFIG_NETDRV=m\nCONFIG_ARM_ONLY=y\n")
        result = subprocess.run(
            [sys.executable, SCRIPT, self.tree, ours, alpine],
            capture_output=True, text=True, check=True,
        )
        self.assertEqual(
            result.stdout,
            "drivers/net\n  CONFIG_NETDRV  Network drivers\nfs\n  CONFIG_A  Prompt A\n",
        )


if __name__ == "__main__":
    unittest.main()
