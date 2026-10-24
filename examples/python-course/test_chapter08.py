from concurrent.futures import ThreadPoolExecutor
from contextlib import closing
from pathlib import Path
import sqlite3
import tempfile
import threading
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
from chapter04.notes_tool.domain import Note
from chapter07.api import Settings
from chapter07.jobs import Busy, Conflict
from chapter08 import storage
from chapter08.api import create_app
from chapter08.storage import ConnectionPool, MigrationError, NotesRepository, connect, migrate, transaction

TOKEN = "local-demo-token-2026"
HEADERS = {"Authorization": "Bearer " + TOKEN}


class DatabaseTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="atlas-notes-db-")
        self.path = Path(self.temporary.name) / "notes.sqlite3"

    def tearDown(self):
        self.temporary.cleanup()

    def test_upgrade_preserves_data_and_history_repeated_start_is_idempotent(self):
        migrate(self.path, target=1)
        with closing(connect(self.path)) as connection:
            connection.execute("INSERT INTO notes VALUES(?,?)", ("n1", "before upgrade")).close()
        migrate(self.path)
        migrate(self.path)
        with closing(connect(self.path)) as connection:
            self.assertEqual(NotesRepository(connection).snapshot(),
                             [{"id": "n1", "title": "before upgrade", "tags": []}])
            self.assertEqual(connection.execute("SELECT version FROM schema_migrations ORDER BY version").fetchall(), [(1,), (2,)])

    def test_migration_failure_rolls_back_ddl_and_history(self):
        migrate(self.path, target=1)
        faulty = (storage.MIGRATIONS[0], ("CREATE TABLE partial(id INTEGER)", "NOT VALID SQL"))
        with patch.object(storage, "MIGRATIONS", faulty):
            with self.assertRaises(sqlite3.OperationalError):
                migrate(self.path)
        with closing(connect(self.path)) as connection:
            self.assertIsNone(connection.execute("SELECT name FROM sqlite_master WHERE name='partial'").fetchone())
            self.assertEqual(connection.execute("SELECT count(*) FROM schema_migrations").fetchone()[0], 1)
        migrate(self.path)

    def test_changed_or_future_history_refuses_startup(self):
        migrate(self.path)
        with closing(connect(self.path)) as connection:
            connection.execute("UPDATE schema_migrations SET checksum='changed' WHERE version=1").close()
        with self.assertRaises(MigrationError):
            migrate(self.path)
        with closing(connect(self.path)) as connection:
            connection.execute("DELETE FROM schema_migrations").close()
            connection.execute("INSERT INTO schema_migrations VALUES(3,'future')").close()
        with self.assertRaises(MigrationError):
            migrate(self.path)
        # A database built from the earlier unpublished draft is also rejected;
        # do not silently accept a checksum difference when fixing the schema.
        draft = self.path.with_name("old-draft.sqlite3")
        current = storage.MIGRATIONS
        previous = ((current[0][0].replace("id TEXT NOT NULL PRIMARY KEY", "id TEXT PRIMARY KEY"),),
                    current[1])
        self.assertNotEqual(previous, current)
        with patch.object(storage, "MIGRATIONS", previous):
            migrate(draft)
        with self.assertRaises(MigrationError):
            migrate(draft)

    def test_text_primary_key_explicitly_rejects_multiple_null_ids(self):
        migrate(self.path)
        with closing(connect(self.path)) as connection:
            for title in ("first NULL", "second NULL"):
                with self.assertRaises(sqlite3.IntegrityError):
                    connection.execute("INSERT INTO notes(id,title) VALUES(?,?)", (None, title))
            with closing(connection.execute("PRAGMA table_info(notes)")) as cursor:
                id_column = next(row for row in cursor if row[1] == "id")
            self.assertEqual(id_column[3], 1)  # Explicit NOT NULL, independent of PK.
            self.assertEqual(connection.execute("SELECT count(*) FROM notes").fetchone()[0], 0)
            NotesRepository(connection).add_batch((Note("valid", "non-null"),))
            self.assertEqual(NotesRepository(connection).snapshot()[0]["id"], "valid")

    def test_real_second_insert_conflict_rolls_back_first_and_persists_reopen(self):
        migrate(self.path)
        pool = ConnectionPool(self.path)
        with pool.borrow() as connection:
            repo = NotesRepository(connection)
            repo.add_batch((Note("n2", "existing", ("python",)),))
            with self.assertRaises(Conflict):
                repo.add_batch((Note("n1", "must roll back", ("new",)), Note("n2", "duplicate")))
            self.assertFalse(connection.in_transaction)
            self.assertEqual([n["id"] for n in repo.snapshot()], ["n2"])
        pool.close()
        with closing(connect(self.path)) as connection:
            self.assertEqual(NotesRepository(connection).snapshot(),
                             [{"id": "n2", "title": "existing", "tags": ["python"]}])

    def test_parameters_and_foreign_keys_are_real_database_boundaries(self):
        migrate(self.path)
        with closing(connect(self.path)) as connection:
            title = "x'); DROP TABLE notes; --"
            NotesRepository(connection).add_batch((Note("safe", title, ("sql",)),))
            self.assertEqual(NotesRepository(connection).snapshot()[0]["title"], title)
            with self.assertRaises(sqlite3.IntegrityError):
                connection.execute("INSERT INTO note_tags VALUES(?,?,?)", ("missing", 0, "tag"))

    def test_pool_saturation_close_and_return_do_not_reuse_active_connection(self):
        migrate(self.path)
        pool = ConnectionPool(self.path, 1)
        entered, release = threading.Event(), threading.Event()
        def occupy():
            with pool.borrow() as connection:
                entered.set()
                self.assertTrue(release.wait(2))
                return connection
        with ThreadPoolExecutor(1) as executor:
            future = executor.submit(occupy)
            try:
                self.assertTrue(entered.wait(1))
                with self.assertRaises(Busy):
                    with pool.borrow(wait=.02):
                        self.fail("saturated pool must not produce another lease")
                with self.assertRaises(Busy):
                    pool.close()
            finally:
                release.set()
            first = future.result(timeout=2)
        with pool.borrow() as returned:
            self.assertIs(first, returned)
        pool.close()
        pool.close()
        with self.assertRaises(Busy):
            with pool.borrow():
                pass

    def test_return_rolls_back_unfinished_transaction_and_broken_handle_fails_closed(self):
        migrate(self.path)
        pool = ConnectionPool(self.path, 1)
        with pool.borrow() as connection:
            connection.execute("BEGIN IMMEDIATE").close()
            connection.execute("INSERT INTO notes VALUES('leak','uncommitted')").close()
        with pool.borrow() as connection:
            self.assertFalse(connection.in_transaction)
            self.assertEqual(NotesRepository(connection).snapshot(), [])
        with self.assertRaises(sqlite3.ProgrammingError):
            with pool.borrow() as connection:
                connection.close()  # Simulate misuse/broken connection, not a normal caller.
        with self.assertRaises(Busy):
            with pool.borrow():
                pass
        pool.close()

    def test_two_connections_observe_real_writer_lock_and_recover(self):
        migrate(self.path)
        pool = ConnectionPool(self.path, 2)
        with pool.borrow() as first:
            with transaction(first):
                first.execute("INSERT INTO notes VALUES('held','writer')").close()
                with pool.borrow() as second:
                    with self.assertRaises(Busy):
                        NotesRepository(second).add_batch((Note("other", "blocked"),))
                    self.assertFalse(second.in_transaction)
        with pool.borrow() as connection:
            NotesRepository(connection).add_batch((Note("other", "recovered"),))
            self.assertEqual(len(NotesRepository(connection).snapshot()), 2)
        pool.close()

    def test_http_persistence_atomic_import_conflict_and_pool_503(self):
        app = create_app(self.path, Settings(TOKEN), pool_size=1)
        note = {"id": "n1", "title": "persistent", "tags": ["python"]}
        with TestClient(app) as client:
            self.assertEqual(client.post("/notes", json=note, headers=HEADERS).status_code, 201)
            batch = {"notes": [{"id": "n2", "title": "rollback", "tags": []}, note]}
            self.assertEqual(client.post("/imports", json=batch, headers=HEADERS).status_code, 409)
            with app.state.pool.borrow():
                response = client.get("/notes", headers=HEADERS)
                self.assertEqual(response.status_code, 503)
                self.assertEqual(response.headers["retry-after"], "1")
            self.assertEqual(client.get("/notes", headers=HEADERS).json()["notes"], [note])
        self.assertTrue(app.state.pool.closed)
        with TestClient(create_app(self.path, Settings(TOKEN))) as client:
            self.assertEqual(client.get("/notes", headers=HEADERS).json()["notes"], [note])
            self.assertEqual(client.get("/notes").status_code, 401)

    def test_two_query_read_keeps_one_snapshot_across_concurrent_commit(self):
        migrate(self.path)
        with closing(connect(self.path)) as reader, closing(connect(self.path)) as writer:
            NotesRepository(writer).add_batch((Note("n1", "snapshot", ("old",)),))
            changed = False
            def between_queries(statement):
                nonlocal changed
                if statement.startswith("SELECT note_id,tag") and not changed:
                    changed = True
                    with transaction(writer):
                        writer.execute("UPDATE note_tags SET tag='new' WHERE note_id='n1'").close()
            reader.set_trace_callback(between_queries)
            self.assertEqual(NotesRepository(reader).snapshot()[0]["tags"], ["old"])
            self.assertTrue(changed)
            reader.set_trace_callback(None)
            self.assertEqual(NotesRepository(reader).snapshot()[0]["tags"], ["new"])

    def test_note_capacity_is_checked_inside_write_transaction(self):
        migrate(self.path)
        with closing(connect(self.path)) as connection:
            connection.executemany("INSERT INTO notes VALUES(?,?)", [(f"n{i}", "bounded") for i in range(512)]).close()
            with self.assertRaises(Busy):
                NotesRepository(connection).add_batch((Note("overflow", "reject"),))
            self.assertFalse(connection.in_transaction)
            self.assertEqual(connection.execute("SELECT count(*) FROM notes").fetchone()[0], 512)


if __name__ == "__main__":
    unittest.main(verbosity=2)
