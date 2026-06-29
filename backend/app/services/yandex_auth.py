import asyncio
import logging
import uuid
from concurrent.futures import ThreadPoolExecutor

import keyring
import keyring.errors

logger = logging.getLogger(__name__)

_KEYRING_SERVICE = "soundsave"
_KEYRING_USER = "yandex_token"
_executor = ThreadPoolExecutor(max_workers=2)

# In-memory sessions: session_id -> {device_code, status, token, error}
_sessions: dict[str, dict] = {}


def get_stored_token() -> str | None:
    return keyring.get_password(_KEYRING_SERVICE, _KEYRING_USER) or None


def save_token(token: str) -> None:
    keyring.set_password(_KEYRING_SERVICE, _KEYRING_USER, token)
    logger.info("Yandex Music token saved to system keyring")


def delete_token() -> None:
    try:
        keyring.delete_password(_KEYRING_SERVICE, _KEYRING_USER)
    except keyring.errors.PasswordDeleteError:
        pass


def _request_code_sync() -> dict:
    from yandex_music import Client

    client = Client().init()
    code = client.request_device_code()
    return {
        "user_code": code.user_code,
        "verification_url": code.verification_url,
        "device_code": code.device_code,
        "expires_in": code.expires_in,
        "interval": code.interval,
    }


def _poll_token_sync(device_code: str, interval: float) -> str | None:
    """Poll until token received or 300s timeout. Returns token string or raises."""
    import time
    from yandex_music import Client

    client = Client().init()
    deadline = time.monotonic() + 300
    while time.monotonic() < deadline:
        token = client.poll_device_token(device_code)
        if token is not None:
            return token.access_token
        time.sleep(interval)
    raise TimeoutError("Yandex auth timed out (5 min)")


async def start_device_auth() -> dict:
    """Start device auth flow. Returns session_id + user_code + verification_url."""
    loop = asyncio.get_running_loop()
    code_info = await loop.run_in_executor(_executor, _request_code_sync)

    session_id = str(uuid.uuid4())
    _sessions[session_id] = {
        "status": "pending",
        "device_code": code_info["device_code"],
        "token": None,
        "error": None,
    }

    # Start background polling task
    asyncio.create_task(
        _poll_session(session_id, code_info["device_code"], code_info["interval"])
    )

    return {
        "session_id": session_id,
        "user_code": code_info["user_code"],
        "verification_url": code_info["verification_url"],
        "expires_in": code_info["expires_in"],
    }


async def _poll_session(session_id: str, device_code: str, interval: float) -> None:
    loop = asyncio.get_running_loop()
    try:
        token = await loop.run_in_executor(
            _executor, _poll_token_sync, device_code, interval
        )
        save_token(token)
        if session_id in _sessions:
            _sessions[session_id]["status"] = "done"
            _sessions[session_id]["token"] = token
        logger.info("Yandex Music authorized successfully")
    except Exception as e:
        logger.warning("Yandex auth polling failed: %s", e)
        if session_id in _sessions:
            _sessions[session_id]["status"] = "error"
            _sessions[session_id]["error"] = str(e)


def get_session_status(session_id: str) -> dict | None:
    return _sessions.get(session_id)
