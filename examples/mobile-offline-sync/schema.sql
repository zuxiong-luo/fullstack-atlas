PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS metadata(account TEXT NOT NULL PRIMARY KEY);
CREATE TABLE IF NOT EXISTS notes(
 id TEXT NOT NULL PRIMARY KEY,body TEXT NOT NULL,
 server_version INTEGER NOT NULL CHECK(server_version>=1),
 edit_revision INTEGER NOT NULL CHECK(edit_revision>=0)
);
CREATE TABLE IF NOT EXISTS pending(
 op_id TEXT NOT NULL PRIMARY KEY,note_id TEXT NOT NULL UNIQUE REFERENCES notes(id),
 body TEXT NOT NULL,base_version INTEGER NOT NULL CHECK(base_version>=1),
 edit_revision INTEGER NOT NULL,status TEXT NOT NULL CHECK(status IN ('queued','conflict')),
 remote_body TEXT,remote_version INTEGER,
 CHECK((status='queued' AND remote_body IS NULL AND remote_version IS NULL)
 OR(status='conflict' AND remote_body IS NOT NULL AND remote_version IS NOT NULL))
);
