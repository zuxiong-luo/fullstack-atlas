import asyncio
from contextlib import redirect_stdout
import io
import json
from pathlib import Path
import runpy
import sqlite3
import subprocess
import sys
import tempfile
import unittest

from functions_demo import add_minutes, make_note, add_label, count_to, make_prefix
from learning_notes.models import Note, Notebook
from learning_notes.files import save_book, load_book
from learning_notes.storage import NotesStore
from concurrency_demo import threaded_titles, process_squares
from async_demo import compare_orders, read_in_batches, cancel_example, timeout_example, all_or_fail

ROOT = Path(__file__).resolve().parents[1]


class LanguageTests(unittest.TestCase):
    def test_small_script_outputs(self):
        cases = {
            "values.py": ["小林", "20", "30", "9", "3.5", "3", "1", "8", "<class 'int'>", "<class 'float'>", "Python 入门", "True", "6", "P", "Py", "False", "False", "True", "True", "已学 20 分钟", "小林已学 20 分钟", "15"],
            "collections_demo.py": ["['Python', '函数', '类']", "Python", "类", "['Python', '函数']", "3", "10", "2", "True", "学习 Python", "未分类", "{'title': '学习 Python', 'done': True}", "['Python', '函数']", "['Python', '函数']", "['Python', '函数', '类']"],
            "control_flow.py": ["已经开始，继续加油", "待完成：学习 Python", "1", "2", "3", "还剩 2", "还剩 1"],
        }
        for file, expected in cases.items():
            with self.subTest(file=file):
                output = io.StringIO()
                with redirect_stdout(output): runpy.run_path(str(ROOT / file))
                self.assertEqual(output.getvalue().splitlines(), expected)

    def test_each_marked_snippet_runs_without_previous_sections(self):
        for file in ["values.py", "collections_demo.py", "control_flow.py"]:
            source = (ROOT / file).read_text()
            for part in source.split("# section: ")[1:]:
                _, code = part.split("\n", 1)
                with redirect_stdout(io.StringIO()): exec(compile(code, file, "exec"), {})

    def test_familiar_errors(self):
        for snippet, error in [("'3' + 2", TypeError), ("int('十二')", ValueError),
                               ("[1][2]", IndexError), ("{}['title']", KeyError),
                               ("print(unknown_name)", NameError)]:
            with self.subTest(snippet=snippet), self.assertRaises(error): exec(snippet, {})

    def test_function_results_and_fresh_defaults(self):
        self.assertEqual(add_minutes(20, 10), 30)
        self.assertEqual(make_note('  函数  '), {'title': '函数', 'done': False})
        self.assertEqual(add_label('a'), ['a']); self.assertEqual(add_label('b'), ['b'])

    def test_generator_and_closure(self):
        numbers = count_to(3)
        self.assertEqual(next(numbers), 1); self.assertEqual(list(numbers), [2, 3]); self.assertEqual(list(numbers), [])
        self.assertEqual(make_prefix('笔记：')('函数'), '笔记：函数')

    def test_instances_do_not_share_notebook_lists(self):
        first, second = Notebook(), Notebook()
        note = Note('学习类'); first.add(note); note.finish()
        self.assertEqual(note.describe(), '学习类：已完成')
        self.assertEqual(first.titles(), ['学习类']); self.assertEqual(len(second), 0)
        self.assertEqual(list(first), [note])

    def test_dataclass_value_equality_and_fresh_lists(self):
        from dataclass_demo import SimpleNote
        first, second = SimpleNote('类'), SimpleNote('类')
        self.assertEqual(first, second); self.assertIsNot(first, second)
        first.labels.append('python'); self.assertEqual(second.labels, [])


class FileTests(unittest.TestCase):
    def test_roundtrip_and_closed_file(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'notes.json'; book = Notebook(); book.add(Note('文件'))
            save_book(book, path)
            self.assertEqual(load_book(path).to_list(), book.to_list())
            path.write_text('[]', encoding='utf-8'); self.assertEqual(len(load_book(path)), 0)
    def test_bad_input(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'notes.json'
            for value in ['破损JSON', '{}', '[{"title":" ","done":false}]', '[{"title":"x","done":"false"}]']:
                path.write_text(value, encoding='utf-8')
                with self.assertRaises(ValueError): load_book(path)
    def test_missing_file(self):
        with self.assertRaises(FileNotFoundError): load_book(ROOT / 'does-not-exist.json')


class ConcurrencyTests(unittest.TestCase):
    def test_thread_results_keep_input_order(self):
        self.assertEqual(threaded_titles([3, 1, 2]), ['笔记3', '笔记1', '笔记2'])
    def test_process_entry_runs_from_real_file(self):
        result = subprocess.run([sys.executable, str(ROOT / 'concurrency_demo.py')], capture_output=True, text=True, timeout=20, check=True)
        self.assertIn('进程： [1, 4, 9]', result.stdout)
        self.assertIn('编号不能为负数', result.stdout)


class AsyncTests(unittest.IsolatedAsyncioTestCase):
    async def test_order_and_batch_results(self):
        sequential, concurrent = await compare_orders()
        self.assertEqual(sequential, ['A开始', 'A结束', 'B开始', 'B结束'])
        self.assertEqual(concurrent, ['A开始', 'B开始', 'A结束', 'B结束'])
        self.assertEqual(await read_in_batches([3, 1, 2], 2), ['笔记3', '笔记1', '笔记2'])
    async def test_cancel_and_timeout_clean_up(self):
        self.assertEqual(await cancel_example(), ['开始', '清理', '已取消'])
        self.assertEqual(await timeout_example(), ['开始', '清理', '超时'])
    async def test_group_reports_errors(self):
        with self.assertRaises(ExceptionGroup): await all_or_fail([1, -1])
        with self.assertRaises(ValueError): await read_in_batches([1], 0)


class StorageTests(unittest.TestCase):
    def test_commit_reopen_rollback_and_values(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'notes.db'; store = NotesStore(path)
            store.add_many(['SQL'])
            with self.assertRaises(sqlite3.IntegrityError): store.add_many(['Python', 'SQL'])
            reopened = NotesStore(path)
            self.assertEqual([r['title'] for r in reopened.list_notes()], ['SQL'])
            reopened.add_many(["O'Reilly"])
            self.assertEqual([r['title'] for r in reopened.list_notes()], ['SQL', "O'Reilly"])
    def test_value_error_also_rolls_back(self):
        with tempfile.TemporaryDirectory() as folder:
            store = NotesStore(Path(folder) / 'notes.db')
            with self.assertRaises(ValueError): store.add_many(['Python', ' '])
            self.assertEqual(store.list_notes(), [])
    def test_cli_works_from_outside_its_source_directory(self):
        with tempfile.TemporaryDirectory() as folder:
            env = {'PYTHONPATH': str(ROOT)}
            result = subprocess.run([sys.executable, '-m', 'learning_notes', 'add', '--db', str(Path(folder)/'notes.db'), '--title', '命令行'], env=env, cwd=folder, capture_output=True, text=True, check=True)
            self.assertEqual(json.loads(result.stdout)[0]['title'], '命令行')


if __name__ == '__main__': unittest.main()
