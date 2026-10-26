from pathlib import Path
from tempfile import TemporaryDirectory
from learning_notes.models import Note, Notebook
from learning_notes.files import save_book, load_book


def count_notes(book: Notebook) -> int:
    return len(book)


if __name__ == "__main__":
    book = Notebook()
    book.add(Note("把笔记保存到文件"))
    with TemporaryDirectory() as folder:
        path = Path(folder) / "notes.json"
        save_book(book, path)
        restored = load_book(path)
        print(restored.to_list())
        print(count_notes(restored))
        path.write_text("这不是 JSON", encoding="utf-8")
        try:
            load_book(path)
        except ValueError:
            print("读取失败：请检查文件内容")
