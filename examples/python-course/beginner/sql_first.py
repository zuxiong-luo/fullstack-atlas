import sqlite3

connection = sqlite3.connect(":memory:", autocommit=False)
try:
    connection.execute("CREATE TABLE notes(id INTEGER PRIMARY KEY, title TEXT NOT NULL)")
    connection.execute("INSERT INTO notes(title) VALUES(?)", ("学习 SQL",))
    connection.commit()
    rows = connection.execute("SELECT id, title FROM notes ORDER BY id").fetchall()
    print(rows)
finally:
    connection.close()
