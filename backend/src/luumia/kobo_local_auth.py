"""HTTP Digest para el enlace local de KoboCollect a través de ADB."""

import re
from hashlib import md5
from hmac import compare_digest, digest
from secrets import token_bytes, token_hex
from threading import Lock
from time import time
from urllib.request import parse_http_list, parse_keqv_list

from fastapi import Request

REALM = "LuumIA KoboCollect"
NONCE_TTL = 300
NONCE_KEY = token_bytes(32)
REPLAY_LOCK = Lock()
COUNTERS: dict[tuple[str, str], tuple[int, int]] = {}


def is_loopback(request: Request) -> bool:
    return (request.client is not None and request.client.host in ("127.0.0.1", "::1", "testclient")
            and request.url.hostname in ("127.0.0.1", "localhost", "::1", "testserver"))


def signature(value: str) -> str:
    return digest(NONCE_KEY, value.encode(), "sha256").hex()


def challenge() -> str:
    seed = f"{int(time())}:{token_hex(12)}"
    nonce = f"{seed}:{signature(seed)}"
    # KoboCollect admite Digest MD5 para el enlace local; el nonce está firmado con SHA-256.
    return f'Digest realm="{REALM}", nonce="{nonce}", algorithm=MD5, qop="auth"'


def request_digest(request: Request, username: str, password: str) -> bool:
    scheme, _, parameters = request.headers.get("Authorization", "").partition(" ")
    if scheme.lower() != "digest" or not is_loopback(request):
        return False
    try:
        fields = parse_keqv_list(parse_http_list(parameters))
        uri = request.scope.get("raw_path", request.url.path.encode()).decode("ascii")
        if query := request.scope.get("query_string"):
            uri += "?" + query.decode("ascii")
        nonce = fields["nonce"]
        issued, salt, mac = nonce.split(":", 2)
        timestamp = int(issued)
        now = int(time())
        if (not 0 <= now - timestamp < NONCE_TTL or not compare_digest(mac, signature(f"{issued}:{salt}"))
                or fields["username"] != username or fields["realm"] != REALM or fields["uri"] != uri
                or fields["qop"] != "auth" or fields.get("algorithm", "MD5").upper() != "MD5"):
            return False
        nc = fields["nc"]
        cnonce = fields["cnonce"]
        if not re.fullmatch(r"[0-9a-fA-F]{8}", nc) or not 1 <= len(cnonce) <= 128:
            return False
        counter = int(nc, 16)

        def hex_md5(value: str) -> str:
            return md5(value.encode(), usedforsecurity=False).hexdigest()

        credentials = hex_md5(f"{username}:{REALM}:{password}")
        target = hex_md5(f"{request.method}:{uri}")
        expected = hex_md5(f"{credentials}:{nonce}:{nc}:{cnonce}:auth:{target}")
        if not compare_digest(fields["response"], expected):
            return False
    except (UnicodeError, KeyError, ValueError, IndexError):
        return False

    key = (nonce, cnonce)
    with REPLAY_LOCK:
        for inactive in [item for item, (expires, _) in COUNTERS.items() if expires <= now]:
            del COUNTERS[inactive]
        previous = COUNTERS.get(key)
        if counter <= (previous[1] if previous else 0):
            return False
        if not previous and len(COUNTERS) >= 4096:
            return False
        COUNTERS[key] = (timestamp + NONCE_TTL, counter)
    return True
