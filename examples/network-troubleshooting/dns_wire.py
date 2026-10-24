"""Deliberately small DNS A/IN wire subset for a local authoritative fixture."""
import secrets
import socket
import struct


class DnsFailure(ValueError):
    pass


def question(name: str) -> bytes:
    labels = name.rstrip(".").lower().split(".")
    if not labels or len(name) > 253:
        raise DnsFailure("invalid name length")
    encoded = bytearray()
    for label in labels:
        if not 1 <= len(label) <= 63 or any(not (c.isascii() and (c.isalnum() or c == "-")) for c in label):
            raise DnsFailure("invalid DNS label")
        encoded.append(len(label))
        encoded.extend(label.encode("ascii"))
    return bytes(encoded) + b"\0" + struct.pack("!HH", 1, 1)


def read_question(packet: bytes) -> tuple[str, bytes]:
    if len(packet) < 17:
        raise DnsFailure("short DNS packet")
    position, labels = 12, []
    while True:
        if position >= len(packet):
            raise DnsFailure("truncated label")
        length = packet[position]
        position += 1
        if length == 0:
            break
        if length > 63 or position + length > len(packet):
            raise DnsFailure("unsupported or truncated label")
        labels.append(packet[position:position + length].decode("ascii"))
        position += length
    if packet[position:position + 4] != struct.pack("!HH", 1, 1):
        raise DnsFailure("only A/IN supported")
    return ".".join(labels).lower(), packet[12:position + 4]


def query_a(server: tuple[str, int], name: str, *, timeout: float = 1) -> str:
    identifier = secrets.randbits(16)
    query = question(name)
    packet = struct.pack("!HHHHHH", identifier, 0x0100, 1, 0, 0, 0) + query
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as connection:
        connection.settimeout(timeout)
        connection.connect(server)  # Kernel filters responses to this fixture peer.
        connection.send(packet)
        response = connection.recv(512)
    if len(response) < 12:
        raise DnsFailure("short DNS response")
    response_id, flags, questions, answers, _, _ = struct.unpack("!HHHHHH", response[:12])
    if response_id != identifier or not flags & 0x8000 or flags & 0x0200 or questions != 1:
        raise DnsFailure("unexpected ID/flags/question count")
    if response[12:12 + len(query)] != query:
        raise DnsFailure("question mismatch")
    code = flags & 15
    if code == 3:
        raise DnsFailure("NXDOMAIN")
    if code != 0 or answers != 1:
        raise DnsFailure(f"unsupported response rcode={code} answers={answers}")
    answer = response[12 + len(query):]
    if len(answer) != 16:
        raise DnsFailure("unexpected A answer length")
    owner, kind, address_class, ttl, size = struct.unpack("!HHHIH", answer[:12])
    if (owner, kind, address_class, size) != (0xC00C, 1, 1, 4):
        raise DnsFailure("unsupported A answer")
    return socket.inet_ntoa(answer[12:])
