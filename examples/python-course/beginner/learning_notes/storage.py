import sqlite3
from contextlib import closing


class NotesStore:
    def __init__(self, path):
        self.path = str(path)
        with closing(self.connect()) as connection:
            with connection:
                connection.execute("""CREATE TABLE IF NOT EXISTS beginner_notes(
                    id INTEGER PRIMARY KEY,
                    title TEXT NOT NULL UNIQUE,
                    done INTEGER NOT NULL DEFAULT 0 CHECK(done IN (0, 1))
                )""")

    def connect(self):
        return sqlite3.connect(self.path, autocommit=False, timeout=1)

    def add_many(self, titles):
        with closing(self.connect()) as connection:
            with connection:
                for title in titles:
                    if not isinstance(title, str) or not title.strip():
                        raise ValueError("标题不能为空")
                    connection.execute(
                        "INSERT INTO beginner_notes(title) VALUES(?)", (title.strip(),)
                    )

    def list_notes(self):
        with closing(self.connect()) as connection:
            rows = connection.execute(
                "SELECT id, title, done FROM beginner_notes ORDER BY id"
            ).fetchall()
        result = []
        for note_id, title, done in rows:
            result.append({"id": note_id, "title": title, "done": bool(done)})
        return result
