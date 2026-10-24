"""Mock the account-command boundary; no host users or services are changed."""
from contextlib import redirect_stdout
import io
from pathlib import Path
import shutil
import subprocess
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import verify_systemd as lab


class PartialCreationTests(unittest.TestCase):
    def exercise(self, *, removal_succeeds=True, mismatched=False):
        state = {"account": None, "group": None, "work": None}
        calls = []
        output = io.StringIO()

        def lookup_user(name):
            if state["account"] is None:
                raise KeyError(name)
            return state["account"]

        def lookup_group(name):
            if state["group"] is None:
                raise KeyError(name)
            return state["group"]

        def paths(value):
            if value == "/run/systemd/system":
                return SimpleNamespace(is_dir=lambda: True)
            if value == "/proc/1/comm":
                return SimpleNamespace(read_text=lambda: "systemd\n")
            if value == "/proc":
                return SimpleNamespace(iterdir=lambda: iter(()))
            return Path(value)

        def run(arguments, **options):
            calls.append((arguments, options))
            if "useradd" in arguments:
                skeleton = Path(arguments[arguments.index("--skel") + 1])
                self.assertTrue(skeleton.is_dir())
                self.assertEqual(list(skeleton.iterdir()), [])
                uid = int(arguments[arguments.index("--uid") + 1])
                home = arguments[arguments.index("--home-dir") + 1]
                state["work"] = Path(home).parent
                state["account"] = SimpleNamespace(pw_uid=uid + int(mismatched), pw_dir=home)
                state["group"] = SimpleNamespace(gr_gid=uid)
                raise subprocess.TimeoutExpired(arguments, options["timeout"])
            if "userdel" in arguments and removal_succeeds:
                state["account"] = None
            if "groupdel" in arguments:
                state["group"] = None
            if arguments[2:4] == ["rm", "-rf"]:
                shutil.rmtree(arguments[-1])
            return SimpleNamespace(returncode=0, stdout="", stderr="")

        try:
            with patch.object(lab.sys, "platform", "linux"), \
                 patch.object(lab.os, "geteuid", return_value=1000), \
                 patch.object(lab, "Path", side_effect=paths), \
                 patch.object(lab.pwd, "getpwnam", side_effect=lookup_user), \
                 patch.object(lab.grp, "getgrnam", side_effect=lookup_group), \
                 patch.object(lab.pwd, "getpwuid", side_effect=KeyError), \
                 patch.object(lab, "run", side_effect=run), \
                 patch.object(lab.signal, "signal"), redirect_stdout(output):
                with self.assertRaises(RuntimeError if mismatched or not removal_succeeds
                                       else subprocess.TimeoutExpired):
                    lab.main()
            return calls, output.getvalue()
        finally:
            if state["work"] is not None:
                shutil.rmtree(state["work"], ignore_errors=True)

    def test_timeout_still_removes_partial_account_group_and_home(self):
        calls, output = self.exercise()
        creation = next((args, options) for args, options in calls if "useradd" in args)
        self.assertIn("--no-log-init", creation[0])
        self.assertEqual(creation[1]["timeout"], 30)
        self.assertTrue(any("userdel" in args for args, _ in calls))
        self.assertTrue(any("groupdel" in args for args, _ in calls))
        self.assertIn('"cleanup": "complete"', output)

    def test_failed_removal_never_reports_complete(self):
        _, output = self.exercise(removal_succeeds=False)
        self.assertNotIn('"cleanup": "complete"', output)

    def test_mismatched_identity_is_never_deleted(self):
        calls, output = self.exercise(mismatched=True)
        self.assertFalse(any("userdel" in args or "groupdel" in args for args, _ in calls))
        self.assertNotIn('"cleanup": "complete"', output)


if __name__ == "__main__":
    unittest.main(verbosity=2)
