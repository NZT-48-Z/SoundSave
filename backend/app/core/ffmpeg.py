import logging
import shutil

logger = logging.getLogger(__name__)

_ffmpeg_dir: str | None = None


def get_ffmpeg_location() -> str | None:
    """Находит папку с ffmpeg (PATH → static-ffmpeg → imageio-ffmpeg), кэширует."""
    global _ffmpeg_dir
    if _ffmpeg_dir:
        return _ffmpeg_dir

    # 1. Системный PATH
    path = shutil.which("ffmpeg")
    if path:
        import os

        _ffmpeg_dir = os.path.dirname(path)
        logger.info("Using system ffmpeg: %s", path)
        return _ffmpeg_dir

    # 2. static-ffmpeg (при первом запуске сам скачивает бинарники)
    try:
        import static_ffmpeg

        static_ffmpeg.add_paths()
        path = shutil.which("ffmpeg")
        if path:
            import os

            _ffmpeg_dir = os.path.dirname(path)
            logger.info("Using static-ffmpeg: %s", path)
            return _ffmpeg_dir
    except Exception as e:
        logger.warning("static-ffmpeg not available: %s", e)

    # 3. Запасной вариант — imageio-ffmpeg
    try:
        import imageio_ffmpeg
        import os

        exe = imageio_ffmpeg.get_ffmpeg_exe()
        _ffmpeg_dir = os.path.dirname(exe)
        logger.info("Using imageio-ffmpeg: %s", exe)
        return _ffmpeg_dir
    except Exception as e:
        logger.warning("imageio-ffmpeg not available: %s", e)

    logger.error(
        "ffmpeg not found — install with: .venv\\Scripts\\pip install static-ffmpeg"
    )
    return None


def get_ffmpeg_exe() -> str:
    """Возвращает полный путь к исполняемому файлу ffmpeg."""
    import os

    d = get_ffmpeg_location()
    if not d:
        return "ffmpeg"
    exe = "ffmpeg.exe" if os.name == "nt" else "ffmpeg"
    return os.path.join(d, exe)
