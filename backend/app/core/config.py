import os

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Настройки приложения (читаются из окружения и файла ``.env``)."""

    DEBUG: bool = True
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    DOWNLOAD_DIR: str = "~/Music/SoundSave"
    DB_PATH: str = "./soundsave.db"

    # Origin'ы, разрешённые CORS. Дефолты покрывают dev-серверы Vite/React;
    # переопределяется через env (JSON-список), когда приложение за реальным доменом.
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:5173"]

    # Загрузка обложек и исходящие URL — ограничители, важные когда приложение
    # доступно не только с localhost.
    MAX_COVER_UPLOAD_MB: int = 10
    ALLOWED_URL_SCHEMES: set[str] = {"http", "https"}

    # Размер общего пула потоков для оффлоада блокирующей работы (yt-dlp,
    # ffmpeg, keyring, yandex-music) с event loop.
    THREAD_POOL_WORKERS: int = 12

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    @property
    def download_path(self) -> str:
        """Абсолютный путь к папке загрузок (с раскрытым ``~``)."""
        return os.path.expanduser(self.DOWNLOAD_DIR)

    @property
    def covers_path(self) -> str:
        """Папка, где хранятся загруженные обложки."""
        return os.path.join(self.download_path, ".covers")

    @property
    def db_path_abs(self) -> str:
        """Абсолютный путь к БД, не зависящий от рабочей директории процесса."""
        return os.path.abspath(os.path.expanduser(self.DB_PATH))

    @property
    def max_cover_upload_bytes(self) -> int:
        """Максимальный размер загружаемой обложки в байтах."""
        return self.MAX_COVER_UPLOAD_MB * 1024 * 1024


settings = Settings()
