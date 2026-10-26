import json
from .models import Note, Notebook


def save_book(book, path):
    with open(path, "w", encoding="utf-8") as target:
        json.dump(book.to_list(), target, ensure_ascii=False, indent=2)


def load_book(path):
    with open(path, encoding="utf-8") as source:
        rows = json.load(source)
    if not isinstance(rows, list):
        raise ValueError("文件最外层应该是列表")
    book = Notebook()
    for row in rows:
        if not isinstance(row, dict) or set(row) != {"title", "done"}:
            raise ValueError("每条笔记需要 title 和 done")
        if not isinstance(row["title"], str) or not row["title"].strip():
            raise ValueError("标题不能为空")
        if not isinstance(row["done"], bool):
            raise ValueError("done 应该是布尔值")
        note = Note(row["title"].strip())
        if row["done"]:
            note.finish()
        book.add(note)
    return book
