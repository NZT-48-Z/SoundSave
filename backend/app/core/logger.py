import logging
import sys

import colorama
from colorama import Fore, Style

from app.core.config import settings

colorama.init()

LEVEL_COLORS = {
    logging.DEBUG: Fore.CYAN,
    logging.INFO: Fore.GREEN,
    logging.WARNING: Fore.YELLOW,
    logging.ERROR: Fore.RED,
    logging.CRITICAL: Style.BRIGHT + Fore.RED,
}


class ColorFormatter(logging.Formatter):
    """Форматтер логов, подкрашивающий уровень записи цветом."""

    def format(self, record: logging.LogRecord) -> str:
        """Раскрашивает имя уровня и форматирует запись."""
        color = LEVEL_COLORS.get(record.levelno, "")
        record.levelname = f"{color}{record.levelname:<7}{Style.RESET_ALL}"
        return super().format(record)


POLLED_PATHS = {"/api/v1/downloads"}


class SuppressPollingFilter(logging.Filter):
    """Фильтр access-логов: скрывает шумные запросы поллинга загрузок."""

    def filter(self, record: logging.LogRecord) -> bool:
        """False для запросов к поллинг-эндпоинтам, иначе True."""
        if record.args and len(record.args) >= 3 and record.args[2] in POLLED_PATHS:
            return False
        return True


def configure_logging() -> None:
    """Настройка логгера"""
    level = logging.DEBUG if settings.DEBUG else logging.INFO
    fmt = "[%(asctime)s.%(msecs)03d] %(module)12s:%(lineno)-3d %(levelname)s - %(message)s"
    datefmt = "%Y-%m-%d %H:%M:%S"

    root = logging.getLogger()
    root.setLevel(logging.WARNING)

    if not root.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(ColorFormatter(fmt, datefmt))
        root.addHandler(handler)

    # Подробно логируем только свой код и uvicorn — любая сторонняя библиотека
    # остаётся на уровне WARNING корня, если явно не разрешена здесь.
    logging.getLogger("app").setLevel(level)
    logging.getLogger("uvicorn").setLevel(logging.INFO)
    logging.getLogger("uvicorn.access").setLevel(logging.INFO)
    logging.getLogger("uvicorn.access").addFilter(SuppressPollingFilter())
