import asyncio
import logging
import os
import re
import subprocess
import time
import uuid
from typing import Any, Callable

import httpx
import yt_dlp
from mutagen.id3 import APIC, ID3, TALB, TCON, TIT2, TPE1
from mutagen.id3._util import ID3NoHeaderError

from app.core.cache import LockedTTLCache
from app.core.config import settings
from app.core.constants import DownloadStatus
from app.core.exceptions import DownloadError
from app.core.executor import run_blocking
from app.core.ffmpeg import get_ffmpeg_exe, get_ffmpeg_location
from app.database.database import async_session_factory
from app.database.query.orm import AsyncORM
from app.models.download import Download, utcnow
from app.schemas.download import DownloadRequest

logger = logging.getLogger(__name__)

# Контрольные точки прогресса для каждой фазы конвейера (в процентах).
_PROGRESS_DOWNLOAD_MAX = 80  # 0..80 — собственно скачивание медиа
_PROGRESS_CONVERTING = 85
_PROGRESS_CUTTING = 87
_PROGRESS_TAGGING = 92
_PROGRESS_DONE = 100

# Троттлинг записи прогресса в БД: пропускаем запись, пока прогресс не вырос
# на столько (процентов) или не прошло столько времени (секунд) с прошлой записи.
_WRITE_MIN_DELTA = 2.0
_WRITE_MIN_INTERVAL = 0.4

_ARTWORK_TIMEOUT = 15
_CUT_TIMEOUT = 300

# ID, запрошенные к отмене. Читаются из потока загрузки (пула) внутри
# progress-хука yt-dlp и меняются из event loop — безопасно под GIL CPython для
# этих атомарных операций над set. Воркер — единственный, кто пишет терминальный
# статус выполняемой им задачи.
_cancelled_ids: set[str] = set()


def _request_cancel(download_id: str) -> None:
    """Помечает загрузку как запрошенную к отмене."""
    _cancelled_ids.add(download_id)


def _is_cancelled(download_id: str) -> bool:
    """True, если для загрузки была запрошена отмена."""
    return download_id in _cancelled_ids


def _clear_cancel(download_id: str) -> None:
    """Убирает загрузку из набора запрошенных к отмене."""
    _cancelled_ids.discard(download_id)


_ANSI_RE = re.compile(r"\x1b\[[0-9;]*m")


def _clean_error(msg: str) -> str:
    """Убирает ANSI-коды и служебный шум yt-dlp из текста ошибки."""
    msg = _ANSI_RE.sub("", msg)
    match = re.search(r"ERROR:\s*(.*)", msg)
    if match:
        msg = match.group(1).strip()
    if "DRM protected" in msg:
        return "DRM protected — requires SoundCloud Go+ subscription"
    return msg.strip()


def _safe_filename(name: str) -> str:
    """Заменяет недопустимые в имени файла символы на подчёркивание."""
    for ch in r'\/:*?"<>|':
        name = name.replace(ch, "_")
    return name.strip()


def _safe_remove(path: str) -> None:
    """Удаляет файл, молча игнорируя отсутствие/ошибки ОС."""
    try:
        os.remove(path)
    except OSError:
        pass


# --------------------------------------------------------------------------- #
# ID3-тегирование и обрезка (блокирующие, выполняются в потоке пула)
# --------------------------------------------------------------------------- #

_ARTWORK_MIME_BY_EXT = {
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "png": "image/png",
    "webp": "image/webp",
}

# Дедупликация обложек в рамках батча: плейлист/альбом обычно шарит одну
# artwork_url на все треки — короткий TTL достаточно покрывает окно одного импорта.
_artwork_cache = LockedTTLCache(maxsize=200, ttl=120)


def _load_artwork(meta: DownloadRequest) -> tuple[bytes, str] | None:
    """Возвращает ``(байты, mime)`` обложки или ``None``, если её нет."""
    if meta.artwork_local_path and os.path.exists(meta.artwork_local_path):
        try:
            with open(meta.artwork_local_path, "rb") as fh:
                data = fh.read()
            ext = os.path.splitext(meta.artwork_local_path)[1].lower().lstrip(".")
            return data, _ARTWORK_MIME_BY_EXT.get(ext, "image/jpeg")
        except OSError as e:
            logger.warning("Could not read local artwork: %s", e)
            return None

    if meta.artwork_url:
        return _artwork_cache.get_or_set(
            meta.artwork_url, lambda: _fetch_artwork_url(meta.artwork_url)
        )
    return None


def _fetch_artwork_url(url: str) -> tuple[bytes, str] | None:
    """Скачивает обложку по URL. Без кеша — вызывается только через ``_artwork_cache``."""
    try:
        with httpx.Client(timeout=_ARTWORK_TIMEOUT) as client:
            r = client.get(url)
        if r.status_code == 200:
            return r.content, r.headers.get("content-type", "image/jpeg")
    except httpx.HTTPError as e:
        logger.warning("Could not fetch artwork: %s", e)
    return None


def _write_id3(filepath: str, meta: DownloadRequest) -> None:
    """Пишет ID3-теги. Ошибки тегирования логируются и не срывают загрузку."""
    try:
        try:
            tags = ID3(filepath)
        except ID3NoHeaderError:
            tags = ID3()

        tags["TIT2"] = TIT2(encoding=3, text=meta.title)
        tags["TPE1"] = TPE1(encoding=3, text=meta.artist)
        if meta.album:
            tags["TALB"] = TALB(encoding=3, text=meta.album)
        if meta.genre:
            tags["TCON"] = TCON(encoding=3, text=meta.genre)

        artwork = _load_artwork(meta)
        if artwork:
            data, mime = artwork
            tags["APIC"] = APIC(
                encoding=3, mime=mime, type=3, desc="Cover", data=data
            )

        tags.save(filepath)
        logger.info("ID3 tags written: %s", filepath)
    except Exception as e:
        logger.error("ID3 write failed for %s: %s", filepath, e)


def _cut_audio(filepath: str, start: float | None, end: float | None) -> None:
    """Обрезает ``filepath`` на месте до диапазона [start, end] (в секундах)."""
    if start is not None and end is not None and start >= end:
        raise DownloadError(f"Invalid cut range: start ({start}) >= end ({end})")

    tmp_path = filepath + ".cut.mp3"
    cmd = [get_ffmpeg_exe(), "-y", "-i", filepath]
    if start is not None:
        cmd += ["-ss", str(start)]
    if end is not None:
        cmd += ["-to", str(end)]
    cmd += ["-acodec", "libmp3lame", "-b:a", "320k", tmp_path]

    try:
        result = subprocess.run(
            cmd, capture_output=True, text=True, timeout=_CUT_TIMEOUT
        )
    except subprocess.TimeoutExpired as e:
        _safe_remove(tmp_path)
        raise DownloadError("Cut timed out") from e

    if result.returncode != 0 or not os.path.exists(tmp_path):
        _safe_remove(tmp_path)
        raise DownloadError(f"Cut failed: {result.stderr.strip()[-500:]}")

    os.replace(tmp_path, filepath)
    logger.info("Cut audio: %s (start=%s end=%s)", filepath, start, end)


# --------------------------------------------------------------------------- #
# Сама блокирующая загрузка (выполняется в общем пуле)
# --------------------------------------------------------------------------- #


def _build_ydl_opts(out_tmpl: str, progress_hook: Callable[[dict], None]) -> dict:
    """Собирает опции yt-dlp для загрузки лучшего аудио и конвертации в mp3 320k."""
    opts: dict[str, Any] = {
        "format": "bestaudio/best",
        "outtmpl": out_tmpl,
        "postprocessors": [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": "mp3",
                "preferredquality": "320",
            }
        ],
        "quiet": True,
        "no_warnings": True,
        "noprogress": True,
        "logger": logger,
        "progress_hooks": [progress_hook],
    }
    ffmpeg = get_ffmpeg_location()
    if ffmpeg:
        opts["ffmpeg_location"] = ffmpeg
    return opts


def _resolve_mp3_path(found_path: str | None, batch_path: str, safe_title: str) -> str:
    """Определяет итоговый путь mp3 после конвертации."""
    if found_path:
        return os.path.splitext(found_path)[0] + ".mp3"
    return os.path.join(batch_path, f"{safe_title}.mp3")


def _run_download(
    download_id: str,
    meta: DownloadRequest,
    loop: asyncio.AbstractEventLoop,
    batch_dir: str,
) -> str:
    """Загружает, конвертирует, при необходимости обрезает и тегирует трек.

    Возвращает путь к mp3. Целиком выполняется в потоке пула; записи в БД
    маршалятся обратно в event loop. Записи упорядочены (каждая ждёт предыдущую),
    чтобы более медленный ранний коммит не перезаписал более новый и не откатил
    прогресс-бар; троттлинг делает стоимость упорядочивания незначительной.
    """
    max_progress = 0.0
    last_written = -1.0
    last_write_ts = 0.0
    found_path: str | None = None
    pending_write: Any = None

    def flush_pending() -> None:
        """Дожидается завершения предыдущей записи прогресса в БД."""
        nonlocal pending_write
        if pending_write is not None:
            try:
                pending_write.result(timeout=30)
            except Exception as e:
                logger.debug("Progress write did not complete: %s", e)
            pending_write = None

    def schedule_update(**fields) -> None:
        """Планирует запись полей в БД, сохраняя порядок записей."""
        nonlocal pending_write
        flush_pending()
        pending_write = asyncio.run_coroutine_threadsafe(
            _update_db(download_id, **fields), loop
        )

    def progress_hook(d: dict) -> None:
        """Хук прогресса yt-dlp: обновляет прогресс и прерывает загрузку при отмене."""
        nonlocal max_progress, last_written, last_write_ts, found_path
        if _is_cancelled(download_id):
            raise yt_dlp.utils.DownloadError("Cancelled by user")

        status = d.get("status")
        if status == "downloading":
            total = d.get("total_bytes") or d.get("total_bytes_estimate") or 0
            downloaded = d.get("downloaded_bytes", 0)
            progress = (
                round(downloaded / total * _PROGRESS_DOWNLOAD_MAX, 1) if total else 0.0
            )
            # total_bytes_estimate может пересматриваться по ходу загрузки;
            # ограничиваем снизу, чтобы бар не прыгал назад.
            progress = max(progress, max_progress)
            max_progress = progress

            now = time.monotonic()
            if (
                progress - last_written >= _WRITE_MIN_DELTA
                or now - last_write_ts >= _WRITE_MIN_INTERVAL
            ):
                last_written = progress
                last_write_ts = now
                schedule_update(
                    status=DownloadStatus.DOWNLOADING,
                    progress=progress,
                    speed=d.get("speed"),
                )
        elif status == "finished":
            found_path = d.get("filename", "")
            if not _is_cancelled(download_id):
                schedule_update(
                    status=DownloadStatus.CONVERTING,
                    progress=_PROGRESS_CONVERTING,
                    speed=None,
                )

    batch_path = os.path.join(settings.download_path, batch_dir)
    os.makedirs(batch_path, exist_ok=True)
    safe_title = _safe_filename(meta.title)
    out_tmpl = os.path.join(batch_path, f"{safe_title}.%(ext)s")

    try:
        with yt_dlp.YoutubeDL(_build_ydl_opts(out_tmpl, progress_hook)) as ydl:
            ydl.download([meta.url])
    except yt_dlp.utils.DownloadError as e:
        raise DownloadError(_clean_error(str(e))) from e

    if _is_cancelled(download_id):
        raise DownloadError("Cancelled by user")

    mp3 = _resolve_mp3_path(found_path, batch_path, safe_title)
    if not os.path.exists(mp3):
        raise DownloadError(f"File not found after download: {mp3}")

    if meta.cut_start is not None or meta.cut_end is not None:
        schedule_update(
            status=DownloadStatus.CUTTING, progress=_PROGRESS_CUTTING, speed=None
        )
        _cut_audio(mp3, meta.cut_start, meta.cut_end)

    schedule_update(
        status=DownloadStatus.TAGGING, progress=_PROGRESS_TAGGING, speed=None
    )
    _write_id3(mp3, meta)

    # Гарантируем, что последняя запись прогресса дойдёт до БД раньше,
    # чем воркер запишет "done".
    flush_pending()
    return mp3


async def _update_db(download_id: str, **fields) -> None:
    """Открывает сессию, обновляет запись загрузки и коммитит."""
    async with async_session_factory() as session:
        await AsyncORM.update_download(session, download_id, **fields)
        await session.commit()


# --------------------------------------------------------------------------- #
# Хелперы очистки файловой системы
# --------------------------------------------------------------------------- #


def _cleanup_partial_files(batch_dir: str, safe_title: str) -> None:
    """Удаляет остаточные файлы (недокачки, .cut.mp3) после отмены/ошибки."""
    dir_path = os.path.join(settings.download_path, batch_dir)
    if not os.path.isdir(dir_path):
        return
    try:
        for filename in os.listdir(dir_path):
            if filename.startswith(safe_title + "."):
                _safe_remove(os.path.join(dir_path, filename))
    except OSError:
        pass


def _cleanup_batch_dir_if_empty(batch_dir: str) -> None:
    """Удаляет папку батча, если она опустела."""
    path = os.path.join(settings.download_path, batch_dir)
    try:
        if os.path.isdir(path) and not os.listdir(path):
            os.rmdir(path)
    except OSError:
        pass


# --------------------------------------------------------------------------- #
# Пул воркеров загрузок
# --------------------------------------------------------------------------- #


class DownloadQueue:
    """Пул фоновых воркеров, обрабатывающих загрузки из общей очереди."""

    def __init__(self) -> None:
        """Инициализирует очередь и внутреннее состояние пула воркеров."""
        self._queue: asyncio.Queue[tuple[str, DownloadRequest, str]] = asyncio.Queue()
        self._tasks: list[asyncio.Task] = []
        self._stopping = False
        self._active_ids: set[str] = set()

    async def start(self) -> None:
        """Запускает пул воркеров под супервизией."""
        self._stopping = False
        self._tasks = [
            asyncio.create_task(self._supervise(i))
            for i in range(settings.DOWNLOAD_CONCURRENCY)
        ]

    async def stop(self) -> None:
        """Останавливает пул воркеров и сигналит отмену всем активным загрузкам."""
        self._stopping = True
        for download_id in list(self._active_ids):
            _request_cancel(download_id)
        for task in self._tasks:
            task.cancel()
        if self._tasks:
            await asyncio.gather(*self._tasks, return_exceptions=True)
        self._tasks = []

    async def enqueue_many(
        self, items: list[tuple[DownloadRequest, str]]
    ) -> list[str]:
        """Создаёт записи ``pending`` одной транзакцией и ставит загрузки в очередь."""
        download_ids: list[str] = []
        rows: list[Download] = []
        for meta, _ in items:
            download_id = str(uuid.uuid4())
            download_ids.append(download_id)
            rows.append(
                Download(
                    id=download_id,
                    url=meta.url,
                    title=meta.title,
                    artist=meta.artist,
                    album=meta.album,
                    genre=meta.genre,
                    artwork_url=meta.artwork_url,
                    status=DownloadStatus.PENDING,
                    progress=0.0,
                    started_at=utcnow(),
                )
            )

        async with async_session_factory() as session:
            session.add_all(rows)
            await session.commit()

        for (meta, batch_dir), download_id in zip(items, download_ids):
            await self._queue.put((download_id, meta, batch_dir))

        return download_ids

    async def cancel(self, download_id: str) -> None:
        """Запрашивает отмену; для стоящих в очереди сразу пишет статус ``cancelled``."""
        _request_cancel(download_id)
        # Мгновенная обратная связь для задач, ещё стоящих в очереди. Активные
        # задачи оставляем воркеру: он прервёт их через progress-хук и сам запишет
        # терминальный статус — поэтому здесь нет гонки с финальной записью воркера.
        async with async_session_factory() as session:
            await AsyncORM.mark_cancelled_if_pending(session, download_id)
            await session.commit()

    async def _supervise(self, worker_idx: int) -> None:
        """Держит воркер #worker_idx живым: перезапускает его при неожиданном падении."""
        while not self._stopping:
            try:
                await self._worker()
            except asyncio.CancelledError:
                break
            except Exception:
                logger.exception(
                    "Download worker %d crashed; restarting in 1s", worker_idx
                )
                await asyncio.sleep(1)

    async def _worker(self) -> None:
        """Основной цикл воркера: берёт задачи из общей очереди и обрабатывает их."""
        while True:
            download_id, meta, batch_dir = await self._queue.get()
            self._active_ids.add(download_id)
            try:
                await self._process_one(download_id, meta, batch_dir)
            except Exception:
                logger.exception("Unexpected error processing %s", download_id)
            finally:
                self._active_ids.discard(download_id)
                _clear_cancel(download_id)
                self._queue.task_done()
                _cleanup_batch_dir_if_empty(batch_dir)

    async def _process_one(
        self, download_id: str, meta: DownloadRequest, batch_dir: str
    ) -> None:
        """Обрабатывает одну загрузку и записывает её терминальный статус."""
        safe_title = _safe_filename(meta.title)

        if _is_cancelled(download_id):
            await self._finish_cancelled(download_id, batch_dir, safe_title)
            return

        try:
            await _update_db(
                download_id, status=DownloadStatus.DOWNLOADING, progress=0
            )
            loop = asyncio.get_running_loop()
            mp3_path = await run_blocking(
                _run_download, download_id, meta, loop, batch_dir
            )

            if _is_cancelled(download_id):
                _safe_remove(mp3_path)
                await self._finish_cancelled(download_id, batch_dir, safe_title)
                return

            await self._safe_update(
                download_id,
                status=DownloadStatus.DONE,
                progress=_PROGRESS_DONE,
                filepath=mp3_path,
                filename=os.path.basename(mp3_path),
                finished_at=utcnow(),
                speed=None,
            )
            logger.info("Download done: %s", mp3_path)
        except Exception as e:
            if _is_cancelled(download_id):
                await self._finish_cancelled(download_id, batch_dir, safe_title)
                logger.info("Download cancelled: %s", download_id)
            else:
                logger.error("Download failed [%s]: %s", download_id, e)
                _cleanup_partial_files(batch_dir, safe_title)
                await self._safe_update(
                    download_id,
                    status=DownloadStatus.ERROR,
                    error=str(e),
                    finished_at=utcnow(),
                    speed=None,
                )

    async def _finish_cancelled(
        self, download_id: str, batch_dir: str, safe_title: str
    ) -> None:
        """Чистит остаточные файлы и помечает загрузку как ``cancelled``."""
        _cleanup_partial_files(batch_dir, safe_title)
        await self._safe_update(
            download_id,
            status=DownloadStatus.CANCELLED,
            finished_at=utcnow(),
            speed=None,
        )

    @staticmethod
    async def _safe_update(download_id: str, **fields) -> None:
        """Запись терминального статуса, не пробрасывающая ошибки БД в воркер."""
        try:
            await _update_db(download_id, **fields)
        except Exception:
            logger.exception("Failed to write final status for %s", download_id)


download_queue = DownloadQueue()
