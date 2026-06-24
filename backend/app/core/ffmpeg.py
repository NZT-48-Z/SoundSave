import logging
import shutil

logger = logging.getLogger(__name__)

_ffmpeg_dir: str | None = None


def get_ffmpeg_location() -> str | None:
    global _ffmpeg_dir
    if _ffmpeg_dir:
        return _ffmpeg_dir

    # 1. System PATH
    path = shutil.which("ffmpeg")
    if path:
        import os
        _ffmpeg_dir = os.path.dirname(path)
        logger.info("Using system ffmpeg: %s", path)
        return _ffmpeg_dir

    # 2. static-ffmpeg (auto-downloads binaries on first run)
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

    # 3. imageio-ffmpeg fallback
    try:
        import imageio_ffmpeg
        import os
        exe = imageio_ffmpeg.get_ffmpeg_exe()
        _ffmpeg_dir = os.path.dirname(exe)
        logger.info("Using imageio-ffmpeg: %s", exe)
        return _ffmpeg_dir
    except Exception as e:
        logger.warning("imageio-ffmpeg not available: %s", e)

    logger.error("ffmpeg not found — install with: .venv\\Scripts\\pip install static-ffmpeg")
    return None
