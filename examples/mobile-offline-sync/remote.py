import json
import sqlite3
from local import transaction, valid_body

class Conflict(Exception):
    def __init__(self, code, current=None):
        self.code, self.current = code, current

def initialize(path):
    with sqlite3.connect(path) as db:
        db.executescript("""
        CREATE TABLE IF NOT EXISTS notes(id TEXT NOT NULL PRIMARY KEY,body TEXT NOT NULL,version INTEGER NOT NULL CHECK(version>=1));
        CREATE TABLE IF NOT EXISTS receipts(op_id TEXT NOT NULL PRIMARY KEY,payload TEXT NOT NULL,result TEXT NOT NULL);
        INSERT OR IGNORE INTO notes VALUES('n1','hello',1);
        """)

def apply(path, payload):
    if (not isinstance(payload, dict) or set(payload) != {"op_id", "id", "body", "expected_version"}
        or payload["id"] != "n1" or not isinstance(payload["op_id"], str)
        or len(payload["op_id"]) != 36 or type(payload["expected_version"]) is not int or payload["expected_version"] < 1):
        raise ValueError("BAD_INPUT")
    valid_body(payload["body"])
    encoded = json.dumps(payload, sort_keys=True, ensure_ascii=False)
    db = sqlite3.connect(path, isolation_level=None)
    db.row_factory = sqlite3.Row
    try:
        with transaction(db):
            receipt = db.execute("SELECT payload,result FROM receipts WHERE op_id=?", (payload["op_id"],)).fetchone()
            if receipt:
                if receipt["payload"] != encoded:
                    raise Conflict("KEY_CONFLICT")
                return json.loads(receipt["result"])
            current = dict(db.execute("SELECT * FROM notes WHERE id=?", (payload["id"],)).fetchone())
            if current["version"] != payload["expected_version"]:
                raise Conflict("VERSION_CONFLICT", current)
            changed = db.execute("UPDATE notes SET body=?,version=version+1 WHERE id=? AND version=?",
                                 (payload["body"], payload["id"], payload["expected_version"]))
            if changed.rowcount != 1:
                raise Conflict("VERSION_CONFLICT", current)
            result = {"op_id": payload["op_id"], "id": payload["id"], "body": payload["body"], "version": current["version"] + 1}
            db.execute("INSERT INTO receipts VALUES(?,?,?)", (payload["op_id"], encoded, json.dumps(result)))
            return result
    finally:
        db.close()
