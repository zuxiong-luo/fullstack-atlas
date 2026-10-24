import asyncio
from contextlib import contextmanager
import socket
import socketserver
import threading
from collections.abc import Iterator
from chapter04.notes_tool.domain import Note
from .work import payload

MAX_FRAME = 65536  # Byte capacity for each request/response, including its newline.
Address = tuple[str, int]


class EchoHandler(socketserver.StreamRequestHandler):
    def handle(self) -> None:
        self.request.settimeout(3)
        data = self.rfile.readline(MAX_FRAME + 1)
        if len(data) > MAX_FRAME or not data.endswith(b"\n"):
            return
        self.wfile.write(data)


class EchoServer(socketserver.ThreadingTCPServer):
    block_on_close = True
    daemon_threads = False


@contextmanager
def echo_service() -> Iterator[Address]:
    # Port zero allocates a fresh loopback port; no external endpoint is contacted.
    server = EchoServer(("127.0.0.1", 0), EchoHandler)
    thread = threading.Thread(target=server.serve_forever, name="notes-echo")
    thread.start()
    try:
        yield server.server_address
    finally:
        server.shutdown()
        server.server_close()
        thread.join()


def blocking_echo(address: Address, note: Note) -> dict[str, object]:
    data = payload(note) + b"\n"
    if len(data) > MAX_FRAME:
        raise ValueError("request exceeds frame capacity")
    with socket.create_connection(address, timeout=3) as connection:
        connection.sendall(data)
        with connection.makefile("rb") as source:
            received = source.readline(MAX_FRAME + 1)
    if received != data:
        raise ValueError("incomplete echo response")
    return {"id": note.id, "bytes": len(received) - 1}


async def async_echo(address: Address, note: Note) -> dict[str, object]:
    data = payload(note) + b"\n"
    if len(data) > MAX_FRAME:
        raise ValueError("request exceeds frame capacity")
    async with asyncio.timeout(3):
        reader, writer = await asyncio.open_connection(*address, limit=MAX_FRAME + 1)
        try:
            writer.write(data)
            await writer.drain()
            received = await reader.readline()
            if received != data:
                raise ValueError("incomplete echo response")
            return {"id": note.id, "bytes": len(received) - 1}
        finally:
            writer.close()
            await writer.wait_closed()
