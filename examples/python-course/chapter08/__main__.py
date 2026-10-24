import uvicorn

if __name__ == "__main__":
    uvicorn.run("chapter08.api:build_app", factory=True, host="127.0.0.1", port=8018,
                workers=1, timeout_graceful_shutdown=5)
