from fastapi import FastAPI
import uvicorn

app = FastAPI()


@app.get("/")
def hello():
    return {"message": "你好，Python"}


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=4191)
