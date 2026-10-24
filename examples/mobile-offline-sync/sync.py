import json
from urllib.request import Request, build_opener, ProxyHandler
from urllib.error import HTTPError, URLError
from http.client import HTTPException
from urllib.parse import urlsplit
from local import wire

def sync_one(local, base, token, before_ack=None):
    if not local.sync_guard.acquire(blocking=False):
        raise ValueError("SYNC_BUSY")
    try:
        return _sync_one(local, base, token, before_ack)
    finally:
        local.sync_guard.release()

def _sync_one(local, base, token, before_ack=None):
    url = urlsplit(base)
    if url.scheme != "http" or url.hostname != "127.0.0.1":
        raise ValueError("LOOPBACK_ONLY")
    sent = local.next()
    if not sent:
        return "idle"
    if sent["status"] == "conflict":
        return "conflict"
    request = Request(base + "/sync", data=json.dumps(wire(sent)).encode(),
                      headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"})
    try:
        with build_opener(ProxyHandler({})).open(request, timeout=2) as response:
            raw = response.read(4097)
            if len(raw) > 4096:
                raise ValueError("RESPONSE_LIMIT")
            result = json.loads(raw)
    except HTTPError as error:
        with error:
            raw = error.read(4097)
        if len(raw) > 4096:
            raise ValueError("RESPONSE_LIMIT")
        result = json.loads(raw)
        if error.code == 409 and result.get("error") == "VERSION_CONFLICT":
            local.conflict(sent, result["current"])
            return "conflict"
        raise ValueError("SYNC_REJECTED_" + str(error.code)) from error
    except (URLError, OSError, HTTPException):
        return "offline"
    if before_ack:
        before_ack()
    local.ack(sent, result)
    return "synced"
