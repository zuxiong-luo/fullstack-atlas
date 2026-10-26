# section: lists
subjects = ["Python", "函数"]
subjects.append("类")
print(subjects)
print(subjects[0])
print(subjects[-1])
print(subjects[:2])
print(len(subjects))

# section: tuples_sets
point = (10, 20)
print(point[0])
labels = {"python", "web", "python"}
print(len(labels))
print("python" in labels)

# section: dictionaries
note = {"title": "学习 Python", "done": False}
print(note["title"])
note["done"] = True
print(note.get("tag", "未分类"))
print(note)

# section: copying
first = ["Python"]
alias = first
alias.append("函数")
print(first)
separate = first.copy()
separate.append("类")
print(first)
print(separate)
