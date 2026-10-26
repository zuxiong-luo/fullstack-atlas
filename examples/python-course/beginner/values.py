# section: variables
name = "小林"
minutes = 20
print(name)
print(minutes)
minutes = minutes + 10
print(minutes)

# section: numbers
print(7 + 2)
print(7 / 2)
print(7 // 2)
print(7 % 2)
print(2 ** 3)
print(type(20))
print(type(4.5))

# section: strings
message = "  Python 入门  "
print(message.strip())
print("Python" in message)
print(len("Python"))
print("Python"[0])
print("Python"[:2])

# section: booleans
finished = False
remark = None
print(finished)
print(20 >= 30)
print(not finished)
print(remark is None)

# section: conversion
name = "小林"
minutes = 20
print("已学 " + str(minutes) + " 分钟")
print(f"{name}已学 {minutes} 分钟")
print(int("12") + 3)
