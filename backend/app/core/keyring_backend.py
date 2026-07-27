import base64
import hashlib
import json
import logging
import os

import keyring
import keyring.backend
import keyring.errors
from cryptography.fernet import Fernet, InvalidToken
from keyring.compat import properties

from app.core.config import settings

logger = logging.getLogger(__name__)


def _derive_key(secret: str) -> bytes:
    """Выводит 32-байтный Fernet-ключ из произвольной секретной строки."""
    digest = hashlib.sha256(secret.encode()).digest()
    return base64.urlsafe_b64encode(digest)


class FileKeyring(keyring.backend.KeyringBackend):
    """Файловый keyring-бэкенд для окружений без системного хранилища секретов.

    Хранит все пары (service, username) -> пароль в одном JSON, зашифрованном
    Fernet-ключом, производным от ``settings.KEYRING_SECRET``. Предназначен для
    контейнеров, где нет D-Bus/Secret Service — активируется только если задан
    ``KEYRING_SECRET``, иначе используется обычный системный keyring.
    """

    @properties.classproperty
    def priority(cls) -> float:
        """Не-viable без ``KEYRING_SECRET`` — keyring сам обходит все зарегистрированные
        бэкенды при auto-discovery (get_all_keyring), а не только через set_keyring().
        """
        if not settings.KEYRING_SECRET:
            raise RuntimeError("KEYRING_SECRET is not set")
        return 1

    def __init__(self) -> None:
        super().__init__()
        self._path = settings.keyring_file_path_abs
        self._fernet = Fernet(_derive_key(settings.KEYRING_SECRET))

    def _load(self) -> dict:
        if not os.path.exists(self._path):
            return {}
        try:
            with open(self._path, "rb") as fh:
                raw = self._fernet.decrypt(fh.read())
            return json.loads(raw)
        except (InvalidToken, ValueError, OSError) as e:
            logger.error("Could not read keyring file, treating as empty: %s", e)
            return {}

    def _save(self, data: dict) -> None:
        os.makedirs(os.path.dirname(self._path), exist_ok=True)
        encrypted = self._fernet.encrypt(json.dumps(data).encode())
        with open(self._path, "wb") as fh:
            fh.write(encrypted)

    def get_password(self, service: str, username: str) -> str | None:
        """Возвращает сохранённый пароль или ``None``, если его нет."""
        return self._load().get(f"{service}:{username}")

    def set_password(self, service: str, username: str, password: str) -> None:
        """Сохраняет пароль (перезаписывая существующий, если был)."""
        data = self._load()
        data[f"{service}:{username}"] = password
        self._save(data)

    def delete_password(self, service: str, username: str) -> None:
        """Удаляет пароль; бросает ``PasswordDeleteError``, если его не было."""
        data = self._load()
        key = f"{service}:{username}"
        if key not in data:
            raise keyring.errors.PasswordDeleteError(f"No password for {key}")
        del data[key]
        self._save(data)


def init_keyring() -> None:
    """Переключает keyring на файловый бэкенд, если задан ``KEYRING_SECRET``."""
    if settings.KEYRING_SECRET:
        keyring.set_keyring(FileKeyring())
        logger.info("Using file-based keyring backend at %s", settings.keyring_file_path_abs)
