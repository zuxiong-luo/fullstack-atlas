import argparse
import json
import logging
import os
import sqlite3
import sys
from .storage import NotesStore


def main():
    parser = argparse.ArgumentParser(description="一个小型学习笔记本")
    parser.add_argument("action", choices=["add", "list", "serve"])
    parser.add_argument("--title")
    parser.add_argument("--db", default=os.environ.get("NOTES_DB", "notes.db"))
    args = parser.parse_args()
    if args.action == "add" and not args.title:
        parser.error("add 需要 --title")
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    try:
        if args.action == "serve":
            import uvicorn
            from .storage_api import create_storage_app
            uvicorn.run(create_storage_app(args.db), host="127.0.0.1", port=4192)
            return 0
        store = NotesStore(args.db)
        if args.action == "add":
            store.add_many([args.title])
            logging.info("已保存1条笔记")
        print(json.dumps(store.list_notes(), ensure_ascii=False))
        return 0
    except (ValueError, sqlite3.Error) as error:
        print("操作失败：", error, file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
