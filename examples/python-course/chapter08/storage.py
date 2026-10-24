from collections.abc import Iterator
from contextlib import closing, contextmanager
import hashlib
from pathlib import Path
import sqlite3
import threading
import time
from chapter04.notes_tool.domain import Note
from chapter07.jobs import Busy, Conflict

MIGRATIONS = (
    ("CREATE TABLE notes(id TEXT NOT NULL PRIMARY KEY, title TEXT NOT NULL "
     "CHECK(length(title) BETWEEN 1 AND 200))",),
    ("CREATE TABLE note_tags(note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE, "
     "position INTEGER NOT NULL CHECK(position BETWEEN 0 AND 7), "
     "tag TEXT NOT NULL CHECK(length(tag) BETWEEN 1 AND 32), "
     "PRIMARY KEY(note_id,position), UNIQUE(note_id,tag))",
     "CREATE INDEX notes_title_index ON notes(title)"),
)


class MigrationError(RuntimeError):
    pass


def connect(path: Path) -> sqlite3.Connection:
    connection = sqlite3.connect(path, autocommit=True, check_same_thread=False, timeout=.1)
    connection.execute("PRAGMA foreign_keys=ON").close()
    return connection


@contextmanager
def transaction(connection: sqlite3.Connection) -> Iterator[sqlite3.Connection]:
    # autocommit=True disables Python's implicit transactions. SQL owns this one.
    connection.execute("BEGIN IMMEDIATE").close()
    try:
        yield connection
        connection.execute("COMMIT").close()
    except BaseException:
        if connection.in_transaction:
            connection.execute("ROLLBACK").close()
        raise


def migrate(path: Path, target: int = len(MIGRATIONS)) -> None:
    if type(target) is not int or not 1 <= target <= len(MIGRATIONS):
        raise ValueError("unsupported migration target")
    path.parent.mkdir(parents=True, exist_ok=True)
    with closing(connect(path)) as connection:
        connection.execute("PRAGMA journal_mode=WAL").close()
        with transaction(connection):
            connection.execute("CREATE TABLE IF NOT EXISTS schema_migrations("
                               "version INTEGER PRIMARY KEY, checksum TEXT NOT NULL)").close()
            with closing(connection.execute("SELECT version,checksum FROM schema_migrations ORDER BY version")) as cursor:
                history = cursor.fetchall()
            expected = [(i, hashlib.sha256("\n".join(sql).encode()).hexdigest())
                        for i, sql in enumerate(MIGRATIONS, 1)]
            if len(history) > target or history != expected[:len(history)]:
                raise MigrationError("migration history is newer, changed or discontinuous")
            for version, checksum in expected[len(history):target]:
                for statement in MIGRATIONS[version - 1]:
                    connection.execute(statement).close()
                connection.execute("INSERT INTO schema_migrations VALUES(?,?)", (version, checksum)).close()


class ConnectionPool:
    """Teaching pool: exclusive leases, finite wait, rollback on return, fail closed."""
    def __init__(self, path: Path, size: int = 2) -> None:
        if type(size) is not int or not 1 <= size <= 4:
            raise ValueError("pool size outside 1..4")
        self.condition = threading.Condition()
        self.available: list[sqlite3.Connection] = []
        self.leased: set[sqlite3.Connection] = set()
        self.closed = self.broken = False
        try:
            for _ in range(size):
                self.available.append(connect(path))
        except BaseException:
            self.close()
            raise

    @contextmanager
    def borrow(self, wait: float = .2) -> Iterator[sqlite3.Connection]:
        if not 0 < wait <= 2:
            raise ValueError("pool wait outside (0,2]")
        deadline = time.monotonic() + wait
        with self.condition:
            while True:
                if self.closed or self.broken:
                    raise Busy("database pool unavailable")
                if self.available:
                    connection = self.available.pop()
                    self.leased.add(connection)
                    break
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    raise Busy("database pool acquisition timeout")
                self.condition.wait(remaining)
        reusable = True
        try:
            yield connection
        finally:
            try:
                if connection.in_transaction:
                    connection.execute("ROLLBACK").close()
            except sqlite3.Error:
                reusable = False
                raise
            finally:
                with self.condition:
                    self.leased.remove(connection)
                    if reusable:
                        self.available.append(connection)
                    else:
                        connection.close()
                        self.broken = True
                    self.condition.notify_all()

    def close(self) -> None:
        with self.condition:
            if self.leased:
                raise Busy("cannot close a pool with active leases")
            self.closed = True
            for connection in self.available:
                connection.close()
            self.available.clear()
            self.condition.notify_all()


class NotesRepository:
    def __init__(self, connection: sqlite3.Connection) -> None:
        self.connection = connection

    def add_batch(self, notes: tuple[Note, ...]) -> None:
        if not 1 <= len(notes) <= 32:
            raise ValueError("batch must contain 1..32 notes")
        try:
            with transaction(self.connection):
                with closing(self.connection.execute("SELECT count(*) FROM notes")) as cursor:
                    count = cursor.fetchone()[0]
                if count + len(notes) > 512:
                    raise Busy("note capacity reached")
                for note in notes:
                    self.connection.execute("INSERT INTO notes(id,title) VALUES(?,?)",
                                            (note.id, note.title)).close()
                    self.connection.executemany("INSERT INTO note_tags VALUES(?,?,?)",
                                                [(note.id, i, tag) for i, tag in enumerate(note.tags)]).close()
        except sqlite3.IntegrityError as error:
            raise Conflict("note id or note constraint conflict") from error
        except sqlite3.OperationalError as error:
            if error.sqlite_errorcode in (sqlite3.SQLITE_BUSY, sqlite3.SQLITE_LOCKED):
                raise Busy("database writer busy") from error
            raise

    def snapshot(self) -> list[dict[str, object]]:
        # One read transaction gives the two queries the same database snapshot.
        self.connection.execute("BEGIN").close()
        try:
            with closing(self.connection.execute("SELECT id,title FROM notes ORDER BY id LIMIT 513")) as cursor:
                rows = cursor.fetchall()
            if len(rows) > 512:
                raise Busy("stored notes exceed service capacity")
            result = {key: {"id": key, "title": title, "tags": []} for key, title in rows}
            if result:
                marks = ",".join("?" for _ in result)
                with closing(self.connection.execute("SELECT note_id,tag FROM note_tags WHERE note_id IN ("
                                                     + marks + ") ORDER BY note_id,position", tuple(result))) as cursor:
                    for key, tag in cursor:
                        result[key]["tags"].append(tag)
            self.connection.execute("COMMIT").close()
            return list(result.values())
        except BaseException:
            if self.connection.in_transaction:
                self.connection.execute("ROLLBACK").close()
            raise
