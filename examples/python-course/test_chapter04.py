import contextlib
import io
import json
from pathlib import Path
import subprocess
import sys
import unittest
from unittest.mock import patch

from chapter04.notes_tool import ImportFailure, Note, NoteError, build_notebook, read_notebook

ROOT = Path(__file__).resolve().parent


class PackageBoundaries(unittest.TestCase):
    def test_module_cli_success_failure_and_no_import_side_effects(self):
        success = subprocess.run([sys.executable, "-m", "chapter04.notes_tool", "fixtures/notes.jsonl"],
                                 cwd=ROOT, capture_output=True, text=True)
        self.assertEqual(success.returncode, 0, success.stderr)
        self.assertEqual(json.loads(success.stdout)["count"], 3)
        bad = subprocess.run([sys.executable, "-m", "chapter04.notes_tool", "fixtures/bad.jsonl"],
                             cwd=ROOT, capture_output=True, text=True)
        self.assertEqual(bad.returncode, 2)
        self.assertEqual(bad.stdout, "")
        self.assertIn("line 2", bad.stderr)
        imported = subprocess.run([sys.executable, "-c", "import chapter04.notes_tool"],
                                  cwd=ROOT, capture_output=True, text=True)
        self.assertEqual((imported.returncode, imported.stdout, imported.stderr), (0, "", ""))

    def test_annotations_do_not_replace_runtime_validation(self):
        with self.assertRaises(NoteError):
            Note(1, "Title")
        with self.assertRaises(ImportFailure):
            build_notebook([json.dumps({"id": "n1", "title": "ok", "tags": "python"})])

    def test_error_chain_and_duplicate_physical_line(self):
        with self.assertRaises(ImportFailure) as invalid:
            build_notebook(["\n", "{broken\n"])
        self.assertEqual(invalid.exception.line_number, 2)
        self.assertIsInstance(invalid.exception.__cause__, json.JSONDecodeError)
        row = '{"id":"n1","title":"Title","tags":[]}\n'
        with self.assertRaises(ImportFailure) as duplicate:
            build_notebook([row, "\n", row])
        self.assertEqual(duplicate.exception.line_number, 3)
        self.assertIsInstance(duplicate.exception.__cause__, NoteError)

    def test_owned_source_closes_on_success_and_failure(self):
        rows = (ROOT / "fixtures/notes.jsonl").read_text()
        for contents, fails in ((rows, False), ("{broken", True)):
            source = io.StringIO(contents)
            with patch.object(Path, "open", return_value=source):
                if fails:
                    with self.assertRaises(ImportFailure):
                        read_notebook(Path("owned-source"))
                else:
                    book = read_notebook(Path("owned-source"))
                    self.assertEqual(len(book), 3)
            self.assertTrue(source.closed)
        borrowed = io.StringIO(rows)
        self.assertEqual(len(build_notebook(borrowed)), 3)
        self.assertFalse(borrowed.closed)
        borrowed.close()

    def test_usage_missing_file_and_programming_error(self):
        from chapter04.notes_tool.cli import main
        error_output = io.StringIO()
        with contextlib.redirect_stderr(error_output):
            self.assertEqual(main([]), 2)
            self.assertEqual(main([str(ROOT / "missing")]), 2)
            with patch("chapter04.notes_tool.cli.read_notebook", side_effect=TypeError("bug")):
                with self.assertRaisesRegex(TypeError, "bug"):
                    main(["fixtures/notes.jsonl"])
        self.assertIn("usage", error_output.getvalue())

    def test_line_capacity_and_reusable_result(self):
        with self.assertRaises(ImportFailure):
            build_notebook(["x" * 5], max_chars=4)
        with self.assertRaises(ValueError):
            build_notebook([], max_chars=True)
        book = read_notebook(ROOT / "fixtures/notes.jsonl")
        self.assertEqual(list(book), list(book))
        exported = next(iter(book)).to_dict()
        exported["tags"].append("extra")
        self.assertEqual(next(iter(book)).tags, ("python", "basics"))


if __name__ == "__main__":
    unittest.main()
