# section: conditions
minutes = 20
if minutes >= 30:
    print("今天已经完成计划")
elif minutes > 0:
    print("已经开始，继续加油")
else:
    print("从五分钟开始")

# section: loops
notes = [
    {"title": "学习 Python", "done": False},
    {"title": "复习变量", "done": True},
]
for note in notes:
    if not note["done"]:
        print("待完成：" + note["title"])

# section: range_while
for number in range(1, 4):
    print(number)
remaining = 2
while remaining > 0:
    print("还剩", remaining)
    remaining = remaining - 1
