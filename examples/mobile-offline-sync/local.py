import json
from contextlib import contextmanager
from pathlib import Path
import sqlite3
import uuid
import threading

@contextmanager
def transaction(db):
    db.execute("BEGIN IMMEDIATE")
    try:
        yield
        db.execute("COMMIT")
    except BaseException:
        db.execute("ROLLBACK")
        raise

def valid_body(body):
    if not isinstance(body, str) or len(body) > 120:
        raise ValueError("BODY_LIMIT")
    return body

class Local:
    """One account file, one in-flight sync loop; UI may edit between send and ack."""
    def __init__(self, path, account="demo-a"):
        self.db = sqlite3.connect(path, isolation_level=None)
        self.db.row_factory = sqlite3.Row
        self.db.executescript(Path(__file__).with_name("schema.sql").read_text())
        self.sync_guard = threading.Lock()
        try:
            with transaction(self.db):
                row = self.db.execute("SELECT account FROM metadata").fetchone()
                if row and row["account"] != account:
                    raise ValueError("ACCOUNT_FILE_MISMATCH")
                if not row:
                    self.db.execute("INSERT INTO metadata VALUES(?)", (account,))
                self.db.execute("INSERT OR IGNORE INTO notes VALUES('n1','hello',1,0)")
        except BaseException:
            self.db.close()
            raise

    def close(self):
        self.db.close()

    def note(self):
        return dict(self.db.execute("SELECT * FROM notes WHERE id='n1'").fetchone())

    def next(self):
        row = self.db.execute("SELECT * FROM pending ORDER BY note_id LIMIT 1").fetchone()
        return dict(row) if row else None

    def edit(self, body, fail_after_note=False):
        valid_body(body)
        with transaction(self.db):
            note = self.note()
            revision = note["edit_revision"] + 1
            self.db.execute("UPDATE notes SET body=?,edit_revision=? WHERE id='n1'", (body, revision))
            if fail_after_note:
                raise RuntimeError("LOCAL_CRASH_POINT")
            self.db.execute("DELETE FROM pending WHERE note_id='n1'")
            self.db.execute("INSERT INTO pending VALUES(?,?,?,?,?,'queued',NULL,NULL)",
                            (str(uuid.uuid4()), "n1", body, note["server_version"], revision))

    def ack(self, sent, result):
        if (not isinstance(result, dict) or result.get("id") != sent["note_id"]
            or result.get("op_id") != sent["op_id"] or result.get("body") != sent["body"]
            or type(result.get("version")) is not int or result["version"] <= sent["base_version"]):
            raise ValueError("BAD_ACK")
        with transaction(self.db):
            pending = self.next()
            self.db.execute("UPDATE notes SET server_version=MAX(server_version,?) WHERE id=?",
                            (result["version"], sent["note_id"]))
            if pending and pending["op_id"] == sent["op_id"]:
                self.db.execute("DELETE FROM pending WHERE op_id=?", (sent["op_id"],))
            elif pending:
                # A later local edit was never sent: rebase that intent using a fresh immutable ID.
                self.db.execute("UPDATE pending SET op_id=?,base_version=?,status='queued',remote_body=NULL,remote_version=NULL WHERE op_id=?",
                                (str(uuid.uuid4()), result["version"], pending["op_id"]))

    def conflict(self, sent, remote):
        if (not isinstance(remote, dict) or remote.get("id") != sent["note_id"]
            or not isinstance(remote.get("body"), str) or len(remote["body"]) > 120
            or type(remote.get("version")) is not int or remote["version"] < 1):
            raise ValueError("BAD_CONFLICT")
        with transaction(self.db):
            self.db.execute("UPDATE pending SET status='conflict',remote_body=?,remote_version=? WHERE note_id=?",
                            (remote["body"], remote["version"], sent["note_id"]))

    def resolve(self, keep_local):
        with transaction(self.db):
            row = self.next()
            if not row or row["status"] != "conflict":
                raise ValueError("NO_CONFLICT")
            if keep_local:
                self.db.execute("UPDATE notes SET server_version=? WHERE id=?", (row["remote_version"], row["note_id"]))
                self.db.execute("UPDATE pending SET op_id=?,base_version=?,status='queued',remote_body=NULL,remote_version=NULL WHERE op_id=?",
                                (str(uuid.uuid4()), row["remote_version"], row["op_id"]))
            else:
                self.db.execute("UPDATE notes SET body=?,server_version=? WHERE id=?", (row["remote_body"], row["remote_version"], row["note_id"]))
                self.db.execute("DELETE FROM pending WHERE op_id=?", (row["op_id"],))

def wire(sent):
    return {"op_id": sent["op_id"], "id": sent["note_id"], "body": sent["body"], "expected_version": sent["base_version"]}
