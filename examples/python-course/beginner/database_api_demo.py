import sys
import uvicorn
from learning_notes.storage_api import create_storage_app

if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("用法：python database_api_demo.py 数据库文件路径")
    uvicorn.run(create_storage_app(sys.argv[1]), host="127.0.0.1", port=4192)
