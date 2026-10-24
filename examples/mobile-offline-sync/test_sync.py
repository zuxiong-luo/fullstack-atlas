from contextlib import contextmanager
from pathlib import Path
import secrets
import sqlite3
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from local import Local, wire
from http_fixture import serve
from remote import apply
from sync import sync_one

class SyncTests(unittest.TestCase):
    def setUp(self):
        self.temp = TemporaryDirectory()
        self.path = Path(self.temp.name)
        self.local = Local(self.path / "local.db")
        self.remote = self.path / "remote.db"
        self.token = secrets.token_urlsafe(24)

    def tearDown(self):
        self.local.close()
        self.temp.cleanup()

    def remote_note(self):
        with sqlite3.connect(self.remote) as db:
            return db.execute("SELECT body,version FROM notes WHERE id='n1'").fetchone()

    def test_offline_edit_survives_reopen(self):
        self.local.edit("离线修改")
        self.local.close()
        self.local = Local(self.path / "local.db")
        self.assertEqual(self.local.note()["body"], "离线修改")
        self.assertEqual(self.local.next()["status"], "queued")

    def test_local_transaction_never_saves_note_without_intent(self):
        with self.assertRaisesRegex(RuntimeError, "LOCAL_CRASH_POINT"):
            self.local.edit("must rollback", fail_after_note=True)
        self.assertEqual(self.local.note()["body"], "hello")
        self.assertIsNone(self.local.next())

    def test_reconnect_syncs_and_clears_only_after_ack(self):
        self.local.edit("你好")
        with serve(self.remote, self.token) as base:
            self.assertEqual(sync_one(self.local, base, self.token), "synced")
        self.assertEqual(self.remote_note(), ("你好", 2))
        self.assertIsNone(self.local.next())

    def test_real_connection_failure_preserves_queued_intent(self):
        self.local.edit("saved offline")
        with serve(self.remote, self.token) as base:
            pass
        self.assertEqual(sync_one(self.local, base, self.token), "offline")
        self.assertEqual(self.local.next()["body"], "saved offline")

    def test_lost_response_after_commit_replays_without_double_version(self):
        self.local.edit("once")
        with serve(self.remote, self.token, after_commit=lambda: True) as base:
            self.assertEqual(sync_one(self.local, base, self.token), "offline")
        self.assertEqual(self.remote_note(), ("once", 2))
        self.local.close()
        self.local = Local(self.path / "local.db")
        with serve(self.remote, self.token) as base:
            self.assertEqual(sync_one(self.local, base, self.token), "synced")
        self.assertEqual(self.remote_note(), ("once", 2))
        self.assertIsNone(self.local.next())

    def test_same_operation_id_with_different_payload_is_rejected(self):
        self.local.edit("first")
        with serve(self.remote, self.token):
            payload = wire(self.local.next())
            apply(self.remote, payload)
            from remote import Conflict
            with self.assertRaises(Conflict) as result:
                apply(self.remote, {**payload, "body": "different"})
            self.assertEqual(result.exception.code, "KEY_CONFLICT")

    def test_old_ack_does_not_erase_newer_local_edit(self):
        self.local.edit("first")
        with serve(self.remote, self.token) as base:
            self.assertEqual(sync_one(self.local, base, self.token, before_ack=lambda: self.local.edit("second")), "synced")
            self.assertEqual(self.local.note()["body"], "second")
            self.assertEqual(self.local.next()["base_version"], 2)
            self.assertEqual(sync_one(self.local, base, self.token), "synced")
        self.assertEqual(self.remote_note(), ("second", 3))

    def test_two_devices_conflict_and_explicit_keep_local_rebases_with_new_id(self):
        self.local.edit("device A")
        other = Local(self.path / "other.db")
        try:
            other.edit("device B")
            with serve(self.remote, self.token) as base:
                self.assertEqual(sync_one(other, base, self.token), "synced")
                old_id = self.local.next()["op_id"]
                self.assertEqual(sync_one(self.local, base, self.token), "conflict")
                self.assertEqual(self.local.note()["body"], "device A")
                self.assertEqual(self.local.next()["remote_body"], "device B")
                self.assertEqual(sync_one(self.local, base, self.token), "conflict")
                self.local.resolve(keep_local=True)
                self.assertNotEqual(self.local.next()["op_id"], old_id)
                self.assertEqual(sync_one(self.local, base, self.token), "synced")
            self.assertEqual(self.remote_note(), ("device A", 3))
        finally:
            other.close()

    def test_choose_server_discards_only_after_explicit_resolution(self):
        self.local.edit("local")
        with serve(self.remote, self.token) as base:
            apply(self.remote, {"op_id": "a" * 36, "id": "n1", "body": "remote", "expected_version": 1})
            self.assertEqual(sync_one(self.local, base, self.token), "conflict")
            self.local.resolve(keep_local=False)
        self.assertEqual(self.local.note()["body"], "remote")
        self.assertEqual(self.local.note()["server_version"], 2)
        self.assertIsNone(self.local.next())

    def test_one_loop_guard_rejects_reentrant_connectivity_trigger(self):
        self.local.edit("guarded")
        def trigger_again():
            with self.assertRaisesRegex(ValueError, "SYNC_BUSY"):
                sync_one(self.local, base, self.token)
        with serve(self.remote, self.token) as base:
            self.assertEqual(sync_one(self.local, base, self.token, before_ack=trigger_again), "synced")

    def test_wrong_auth_and_malformed_ack_do_not_clear_local_data(self):
        self.local.edit("private")
        with serve(self.remote, self.token) as base:
            with self.assertRaisesRegex(ValueError, "401"):
                sync_one(self.local, base, "wrong")
        with self.assertRaisesRegex(ValueError, "BAD_ACK"):
            self.local.ack(self.local.next(), {"version": True})
        self.assertEqual(self.local.next()["body"], "private")

    def test_loopback_sync_ignores_inherited_external_proxy(self):
        self.local.edit("local-only transport")
        with serve(self.remote, self.token) as base:
            with patch.dict("os.environ", {"HTTP_PROXY": "http://127.0.0.1:1", "http_proxy": "http://127.0.0.1:1", "NO_PROXY": "", "no_proxy": ""}):
                self.assertEqual(sync_one(self.local, base, self.token), "synced")

    def test_account_file_identity_and_sqlite_not_null_are_explicit(self):
        with self.assertRaisesRegex(ValueError, "ACCOUNT_FILE_MISMATCH"):
            Local(self.path / "local.db", account="different")
        with self.assertRaises(sqlite3.IntegrityError):
            self.local.db.execute("INSERT INTO notes VALUES(NULL,'bad',1,0)")
        self.assertEqual(self.local.db.execute("PRAGMA foreign_keys").fetchone()[0], 1)

    def test_edit_coalesces_unsent_intent_with_fresh_identity_and_validates_input(self):
        self.local.edit("one")
        old = self.local.next()["op_id"]
        self.local.edit("two")
        self.assertNotEqual(self.local.next()["op_id"], old)
        self.assertEqual(self.local.db.execute("SELECT count(*) FROM pending").fetchone()[0], 1)
        with self.assertRaises(ValueError):
            self.local.edit("x" * 121)
        with self.assertRaises(ValueError):
            sync_one(self.local, "https://example.com", self.token)

if __name__ == "__main__":
    unittest.main()
