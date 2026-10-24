import json
import os
import platform
import socket
import sqlite3
import sys
import uvicorn
from . import __version__
from .api import create_app
from .config import Config
from .observability import RequestLog, configure_logging, event


def main() -> int:
    try:
        config = Config.from_env(os.environ)
    except ValueError as error:
        print(json.dumps({"event": "configuration_error", "detail": str(error)}), file=sys.stderr)
        return 2
    configure_logging()
    app = RequestLog(create_app(config.database, config.auth, pool_size=config.pool_size))
    listener = socket.socket()
    try:
        listener.bind(("127.0.0.1", config.port))
        port = listener.getsockname()[1]
        event("listener_bound", host="127.0.0.1", port=port, version=__version__,
              python=platform.python_version(), sqlite=sqlite3.sqlite_version,
              pool_size=config.pool_size)
        # Bound is not ready: clients must still observe /health after lifespan.
        server = uvicorn.Server(uvicorn.Config(app, log_level="warning", access_log=False,
                                              timeout_graceful_shutdown=5))
        try:
            server.run(sockets=[listener])
        except KeyboardInterrupt:
            pass
        if not server.started:
            return 3
    finally:
        listener.close()
        event("server_closed")
    return 0
