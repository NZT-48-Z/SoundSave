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
    def format(self, record: logging.LogRecord) -> str:
        color = LEVEL_COLORS.get(record.levelno, "")
        record.levelname = f"{color}{record.levelname:<7}{Style.RESET_ALL}"
        return super().format(record)


POLLED_PATHS = {"/api/v1/downloads"}


class SuppressPollingFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
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

    # Only our own code and uvicorn are chatty on purpose — every third-party
    # library stays at the root's WARNING level unless explicitly allowed here.
    logging.getLogger("app").setLevel(level)
    logging.getLogger("uvicorn").setLevel(logging.INFO)
    logging.getLogger("uvicorn.access").setLevel(logging.INFO)
    logging.getLogger("uvicorn.access").addFilter(SuppressPollingFilter())
