"""Tests for check-config.py: uv run python -m unittest discover -s kernel"""

import importlib.util
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).with_name("check-config.py")
spec = importlib.util.spec_from_file_location("check_config", SCRIPT)
cc = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cc)


class CheckConfigTest(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.dir.cleanup)

    def write(self, name, text):
        path = Path(self.dir.name, name)
        path.write_text(text)
        return path

    def test_later_fragment_wins(self):
        base = self.write("base.config", "CONFIG_HZ_100=y\n")
        release = self.write("release.config", "# CONFIG_HZ_100 is not set\n")
        self.assertEqual(cc.requested([base, release])["HZ_100"], "n")

    def test_not_set_matches_absent(self):
        self.assertEqual(cc.mismatches({"IO_URING": "n"}, {}), [])

    def test_dropped_option_reported(self):
        self.assertEqual(
            cc.mismatches({"VIRTIO_NET": "y"}, {"VIRTIO_NET": "n"}),
            ["CONFIG_VIRTIO_NET: requested y, got n (probably an unmet dependency)"],
        )

    def test_values_compared_verbatim(self):
        self.assertEqual(
            cc.mismatches(
                {"LOG_BUF_SHIFT": "14", "LOCALVERSION": '""'},
                {"LOG_BUF_SHIFT": "14", "LOCALVERSION": '""'},
            ),
            [],
        )
        self.assertEqual(
            len(cc.mismatches({"SERIAL_8250_NR_UARTS": "2"}, {"SERIAL_8250_NR_UARTS": "4"})),
            1,
        )

    def test_unrequested_options_ignored(self):
        self.assertEqual(cc.mismatches({}, {"PRINTK": "y"}), [])

    def test_value_with_equals_sign(self):
        path = self.write("x.config", 'CONFIG_CMDLINE="a=b"\n# a comment\nnot a setting\n')
        self.assertEqual(cc.read_config(path), {"CMDLINE": '"a=b"'})

    def test_cli_exit_status(self):
        fragment = self.write("base.config", "CONFIG_PRINTK=y\nCONFIG_VIRTIO_NET=y\n")
        good = self.write("good.config", "CONFIG_PRINTK=y\nCONFIG_VIRTIO_NET=y\n")
        bad = self.write("bad.config", "CONFIG_PRINTK=y\n# CONFIG_VIRTIO_NET is not set\n")
        run = lambda config: subprocess.run(
            [sys.executable, SCRIPT, config, fragment], capture_output=True, text=True
        )
        self.assertEqual(run(good).returncode, 0)
        result = run(bad)
        self.assertEqual(result.returncode, 1)
        self.assertIn(
            "CONFIG_VIRTIO_NET: requested y, got n (probably an unmet dependency)",
            result.stderr,
        )


if __name__ == "__main__":
    unittest.main()
