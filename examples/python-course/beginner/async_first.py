import asyncio


async def say_hello():
    print("开始等待")
    await asyncio.sleep(0.01)
    print("你好，Python")


if __name__ == "__main__":
    asyncio.run(say_hello())
