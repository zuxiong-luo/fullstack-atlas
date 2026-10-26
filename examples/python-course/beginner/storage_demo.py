import sqlite3
from pathlib import Path
from tempfile import TemporaryDirectory
from learning_notes.storage import NotesStore

if __name__ == "__main__":
    with TemporaryDirectory() as folder:
        path = Path(folder) / "notes.db"
        store = NotesStore(path)
        store.add_many(["学习 SQL"])
        try:
            store.add_many(["学习 Python", "学习 SQL"])
        except sqlite3.IntegrityError:
            print("标题重复，整批没有保存")
        reopened = NotesStore(path)
        print(reopened.list_notes())
        store.add_many(["O'Reilly 的笔记"])
        print(len(store.list_notes()))
