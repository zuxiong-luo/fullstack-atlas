import uvicorn

if __name__ == "__main__":
    uvicorn.run("chapter07.api:build_app", factory=True, host="127.0.0.1", port=8017,
                workers=1, timeout_graceful_shutdown=5)
