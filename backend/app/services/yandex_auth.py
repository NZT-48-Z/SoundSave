import asyncio
import logging
import time
import uuid

import keyring
import keyring.errors

from app.core.executor import run_blocking

logger = logging.getLogger(__name__)

_KEYRING_SERVICE = "soundsave"
_KEYRING_USER = "yandex_token"

# Сессии в памяти: session_id -> {status, device_code, token, error, created}.
# Чистятся по TTL, чтобы завершённые/брошенные попытки авторизации не копились.
_sessions: dict[str, dict] = {}
_SESSION_TTL = 900  # секунд

# Сильные ссылки на фоновые задачи опроса, чтобы их не собрал GC на лету.
_background_tasks: set[asyncio.Task] = set()


def get_stored_token() -> str | None:
    """Возвращает сохранённый в keyring токен Yandex или ``None``."""
    return keyring.get_password(_KEYRING_SERVICE, _KEYRING_USER) or None


def save_token(token: str) -> None:
    """Сохраняет токен Yandex в системный keyring."""
    keyring.set_password(_KEYRING_SERVICE, _KEYRING_USER, token)
    logger.info("Yandex Music token saved to system keyring")


def delete_token() -> None:
    """Удаляет сохранённый токен Yandex из keyring (если он есть)."""
    try:
        keyring.delete_password(_KEYRING_SERVICE, _KEYRING_USER)
    except keyring.errors.PasswordDeleteError:
        pass


def _prune_sessions() -> None:
    """Убирает из памяти сессии авторизации, просроченные по TTL."""
    now = time.monotonic()
    stale = [sid for sid, s in _sessions.items() if now - s["created"] > _SESSION_TTL]
    for sid in stale:
        _sessions.pop(sid, None)


def _request_code_sync() -> dict:
    """Запрашивает device-code у Yandex (блокирующий вызов)."""
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
    """Опрашивает Yandex до получения токена или истечения 5-минутного таймаута."""
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
    """Запускает device-flow авторизации. Возвращает session_id + user_code + URL."""
    _prune_sessions()
    code_info = await run_blocking(_request_code_sync)

    session_id = str(uuid.uuid4())
    _sessions[session_id] = {
        "status": "pending",
        "device_code": code_info["device_code"],
        "token": None,
        "error": None,
        "created": time.monotonic(),
    }

    task = asyncio.create_task(
        _poll_session(session_id, code_info["device_code"], code_info["interval"])
    )
    _background_tasks.add(task)
    task.add_done_callback(_background_tasks.discard)

    return {
        "session_id": session_id,
        "user_code": code_info["user_code"],
        "verification_url": code_info["verification_url"],
        "expires_in": code_info["expires_in"],
    }


async def _poll_session(session_id: str, device_code: str, interval: float) -> None:
    """Фоновый опрос токена; по успеху сохраняет его и помечает сессию done."""
    try:
        token = await run_blocking(_poll_token_sync, device_code, interval)
        await run_blocking(save_token, token)
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
    """Возвращает состояние сессии авторизации по её id или ``None``."""
    _prune_sessions()
    return _sessions.get(session_id)
