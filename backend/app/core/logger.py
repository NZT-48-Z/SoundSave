import logging
import sys

from app.core.config import settings


def configure_logging() -> None:
    """Настройка логгера"""
    level = logging.DEBUG if settings.DEBUG else logging.INFO
    fmt = "[%(asctime)s.%(msecs)03d] %(module)12s:%(lineno)-3d %(levelname)-7s - %(message)s"
    datefmt = "%Y-%m-%d %H:%M:%S"

    root = logging.getLogger()
    root.setLevel(level)

    if not root.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(logging.Formatter(fmt, datefmt))
        root.addHandler(handler)

    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("yt_dlp").setLevel(logging.WARNING)
