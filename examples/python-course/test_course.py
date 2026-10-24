import dataclasses
import importlib.util
import io
import json
from pathlib import Path
import subprocess
import sys
import unittest

ROOT = Path(__file__).resolve().parent


def load(stage):
    name = f"course_stage_{stage}"
    spec = importlib.util.spec_from_file_location(name, ROOT / f"chapter{stage:02}" / "import_notes.py")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


one, two, three = (load(n) for n in (1, 2, 3))


class Foundations(unittest.TestCase):
    def test_fixture_normalization(self):
        raw = json.loads((ROOT / "fixtures/notes.json").read_text())
        result = one.import_notes(raw)
        self.assertEqual(result[0], {"id": "n1", "title": "Python 对象", "tags": ["python", "basics"]})
        self.assertEqual(raw[0]["tags"], ["Python", " Basics ", "python"])

    def test_empty_and_invalid_root(self):
        self.assertEqual(one.import_notes([]), [])
        for raw in ({}, None, "text", False):
            with self.assertRaises(ValueError):
                one.import_notes(raw)

    def test_fields_and_types(self):
        base = {"id": "n1", "title": "ok", "tags": []}
        for patch in ({"id": 1}, {"title": " "}, {"tags": "python"}, {"tags": [None]}, {"extra": 1}):
            with self.assertRaises(ValueError):
                one.normalize_note(base | patch)

    def test_duplicate_after_normalization(self):
        with self.assertRaisesRegex(ValueError, "duplicate"):
            one.import_notes([{"id": " a ", "title": "x", "tags": []}, {"id": "a", "title": "y", "tags": []}])

    def test_alias_vs_rebinding(self):
        tags = ["python"]
        alias = tags
        tags.append("web")
        self.assertEqual(alias, ["python", "web"])
        tags = ["other"]
        self.assertEqual(alias, ["python", "web"])


class Iteration(unittest.TestCase):
    def test_lazy_failure_and_exhaustion(self):
        source = io.StringIO((ROOT / "fixtures/bad.jsonl").read_text())
        notes = two.iter_notes(source)
        self.assertEqual(source.tell(), 0)
        self.assertEqual(next(notes)["id"], "n1")
        with self.assertRaisesRegex(ValueError, "line 2"):
            next(notes)
        self.assertEqual(list(notes), [])

    def test_blank_lines_and_limit(self):
        self.assertEqual(list(two.iter_notes(["\n", "   \n"])), [])
        with self.assertRaisesRegex(ValueError, "line 1"):
            list(two.iter_notes(["x" * 5], max_chars=4))
        with self.assertRaises(ValueError):
            list(two.iter_notes([], max_chars=True))

    def test_selector_and_duplicates(self):
        with (ROOT / "fixtures/notes.jsonl").open() as source:
            result = list(two.select_unique(two.iter_notes(source), two.make_selector(" PYTHON ")))
        self.assertEqual([note["id"] for note in result], ["n1", "n2"])
        with (ROOT / "fixtures/duplicate.jsonl").open() as source:
            with self.assertRaisesRegex(ValueError, "duplicate"):
                list(two.select_unique(two.iter_notes(source), lambda note: False))

    def test_default_and_closure_examples(self):
        def bad(value, bucket=[]):
            bucket.append(value)
            return bucket
        self.assertEqual(bad(1), [1])
        self.assertEqual(bad(2), [1, 2])
        callbacks = [lambda: index for index in range(3)]
        self.assertEqual([fn() for fn in callbacks], [2, 2, 2])
        fixed = [lambda index=index: index for index in range(3)]
        self.assertEqual([fn() for fn in fixed], [0, 1, 2])

    def test_keyword_only(self):
        with self.assertRaises(TypeError):
            two.iter_notes([], 32)


class Objects(unittest.TestCase):
    def test_value_equality_hash_and_identity(self):
        a = three.Note("n1", "Title", ("python",))
        b = three.Note("n1", "Title", ("python",))
        self.assertEqual(a, b)
        self.assertIsNot(a, b)
        self.assertEqual(len({a, b}), 1)
        with self.assertRaises(dataclasses.FrozenInstanceError):
            a.title = "new"

    def test_runtime_validation(self):
        for args in ((1, "Title", ()), ("n1", " ", ()), ("n1", "Title", []), ("n1", "Title", ("Python",)), ("n1", "Title", ("x", "x"))):
            with self.assertRaises(ValueError):
                three.Note(*args)

    def test_notebook_ownership(self):
        a, b = three.Notebook(), three.Notebook()
        note = three.Note("n1", "Title", ("python",))
        a.add(note)
        self.assertEqual(len(a), 1)
        self.assertEqual(len(b), 0)
        self.assertEqual(a.tagged(" PYTHON "), (note,))
        self.assertEqual(list(a), list(a))
        with self.assertRaises(ValueError):
            a.add(note)
        with self.assertRaises(TypeError):
            a.add({"id": "n2"})

    def test_fixture_and_atomic_return(self):
        with (ROOT / "fixtures/notes.jsonl").open() as source:
            book = three.import_notebook(source)
        self.assertEqual(len(book), 3)
        self.assertEqual(next(iter(book)).tags, ("python", "basics"))
        with (ROOT / "fixtures/bad.jsonl").open() as source:
            with self.assertRaisesRegex(ValueError, "line 2"):
                three.import_notebook(source)


class CLI(unittest.TestCase):
    def run_cli(self, stage, *args):
        return subprocess.run([sys.executable, str(ROOT / f"chapter{stage:02}" / "import_notes.py"), *map(str, args)], text=True, capture_output=True)

    def test_success_all_stages(self):
        for stage in (1, 2, 3):
            file = ROOT / ("fixtures/notes.json" if stage == 1 else "fixtures/notes.jsonl")
            extra = ["python"] if stage == 2 else []
            result = self.run_cli(stage, file, *extra)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(result.stderr, "")
            if stage == 2:
                self.assertEqual(len(result.stdout.splitlines()), 2)
            else:
                self.assertEqual(json.loads(result.stdout)["count"], 3)

    def test_partial_stream_vs_atomic_model(self):
        streamed = self.run_cli(2, ROOT / "fixtures/bad.jsonl", "python")
        modeled = self.run_cli(3, ROOT / "fixtures/bad.jsonl")
        self.assertEqual(streamed.returncode, 2)
        self.assertEqual(len(streamed.stdout.splitlines()), 1)
        self.assertIn("line 2", streamed.stderr)
        self.assertEqual(modeled.returncode, 2)
        self.assertEqual(modeled.stdout, "")

    def test_usage_and_missing_file(self):
        for stage in (1, 2, 3):
            self.assertEqual(self.run_cli(stage).returncode, 2)
            extra = ["python"] if stage == 2 else []
            self.assertEqual(self.run_cli(stage, ROOT / "missing", *extra).returncode, 2)


if __name__ == "__main__":
    unittest.main()
