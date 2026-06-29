import asyncio
import logging
import os
import re
import uuid
from datetime import datetime

import httpx
import yt_dlp
from mutagen.id3 import APIC, ID3, TALB, TCON, TIT2, TPE1
from mutagen.id3._util import ID3NoHeaderError

from app.core.config import settings
from app.core.exceptions import DownloadError
from app.core.ffmpeg import get_ffmpeg_location
from app.database.database import async_session_factory
from app.database.query.orm import AsyncORM
from app.schemas.download import DownloadRequest

logger = logging.getLogger(__name__)

DOWNLOAD_DIR = os.path.expanduser(settings.DOWNLOAD_DIR)

# IDs that have been requested to cancel. Checked in progress_hook to abort yt-dlp.
_cancelled_ids: set[str] = set()

_ANSI_RE = re.compile(r"\x1b\[[0-9;]*m")


def _clean_error(msg: str) -> str:
    """Strip ANSI codes and yt-dlp noise from error messages."""
    msg = _ANSI_RE.sub("", msg)
    # Extract the meaningful part after ERROR:
    match = re.search(r"ERROR:\s*(.*)", msg)
    if match:
        msg = match.group(1).strip()
    if "DRM protected" in msg:
        return "DRM protected — requires SoundCloud Go+ subscription"
    return msg.strip()


def _safe_filename(name: str) -> str:
    for ch in r'\/:*?"<>|':
        name = name.replace(ch, "_")
    return name.strip()


def _write_id3(filepath: str, meta: DownloadRequest) -> None:
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

        if meta.artwork_local_path and os.path.exists(meta.artwork_local_path):
            try:
                with open(meta.artwork_local_path, "rb") as fh:
                    art_data = fh.read()
                _ext = os.path.splitext(meta.artwork_local_path)[1].lower().lstrip(".")
                _mime = {
                    "jpg": "image/jpeg",
                    "jpeg": "image/jpeg",
                    "png": "image/png",
                    "webp": "image/webp",
                }.get(_ext, "image/jpeg")
                tags["APIC"] = APIC(
                    encoding=3, mime=_mime, type=3, desc="Cover", data=art_data
                )
            except Exception as e:
                logger.warning("Could not read local artwork: %s", e)
        elif meta.artwork_url:
            try:
                with httpx.Client(timeout=15) as client:
                    r = client.get(meta.artwork_url)
                    if r.status_code == 200:
                        mime = r.headers.get("content-type", "image/jpeg")
                        tags["APIC"] = APIC(
                            encoding=3,
                            mime=mime,
                            type=3,
                            desc="Cover",
                            data=r.content,
                        )
            except Exception as e:
                logger.warning("Could not embed artwork: %s", e)

        tags.save(filepath)
        logger.info("ID3 tags written: %s", filepath)
    except Exception as e:
        logger.error("ID3 write failed for %s: %s", filepath, e)


def _run_download(
    download_id: str,
    meta: DownloadRequest,
    loop: asyncio.AbstractEventLoop,
    batch_dir: str,
) -> str:
    found_path: list[str] = []

    def progress_hook(d: dict) -> None:
        if download_id in _cancelled_ids:
            raise yt_dlp.utils.DownloadError("Cancelled by user")
        status = d.get("status")
        if status == "downloading":
            total = d.get("total_bytes") or d.get("total_bytes_estimate") or 0
            downloaded = d.get("downloaded_bytes", 0)
            # 0-80% = actual download
            progress = round(downloaded / total * 80, 1) if total else 0
            speed = d.get("speed")
            asyncio.run_coroutine_threadsafe(
                _update_db(
                    download_id, status="downloading", progress=progress, speed=speed
                ),
                loop,
            )
        elif status == "finished":
            found_path.append(d.get("filename", ""))
            if download_id not in _cancelled_ids:
                asyncio.run_coroutine_threadsafe(
                    _update_db(
                        download_id, status="converting", progress=85, speed=None
                    ),
                    loop,
                )

    batch_path = os.path.join(DOWNLOAD_DIR, batch_dir)
    os.makedirs(batch_path, exist_ok=True)

    safe_title = _safe_filename(meta.title)
    out_tmpl = os.path.join(batch_path, f"{safe_title}.%(ext)s")

    ffmpeg = get_ffmpeg_location()
    ydl_opts = {
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
        "progress_hooks": [progress_hook],
    }
    if ffmpeg:
        ydl_opts["ffmpeg_location"] = ffmpeg

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([meta.url])
    except yt_dlp.utils.DownloadError as e:
        raise DownloadError(_clean_error(str(e))) from e

    if download_id in _cancelled_ids:
        raise DownloadError("Cancelled by user")

    # FFmpeg done → 90%, writing tags next
    asyncio.run_coroutine_threadsafe(
        _update_db(download_id, status="tagging", progress=90, speed=None),
        loop,
    )

    # Determine final mp3 path
    if found_path:
        base = os.path.splitext(found_path[0])[0]
        mp3 = base + ".mp3"
    else:
        mp3 = os.path.join(batch_path, f"{safe_title}.mp3")

    if not os.path.exists(mp3):
        raise DownloadError(f"File not found after download: {mp3}")

    _write_id3(mp3, meta)
    return mp3


async def _update_db(download_id: str, **fields) -> None:
    async with async_session_factory() as session:
        await AsyncORM.update_download(session, download_id, **fields)
        await session.commit()


def _cleanup_partial_files(batch_dir: str, safe_title: str) -> None:
    """Remove any leftover files from a cancelled or failed download."""
    dir_path = os.path.join(DOWNLOAD_DIR, batch_dir)
    if not os.path.isdir(dir_path):
        return
    try:
        for filename in os.listdir(dir_path):
            if filename.startswith(safe_title + "."):
                filepath = os.path.join(dir_path, filename)
                try:
                    os.remove(filepath)
                    logger.debug("Removed partial file: %s", filepath)
                except OSError as e:
                    logger.warning("Could not remove partial file %s: %s", filepath, e)
    except OSError:
        pass


def _cleanup_batch_dir_if_empty(batch_dir: str) -> None:
    path = os.path.join(DOWNLOAD_DIR, batch_dir)
    try:
        if os.path.isdir(path) and not os.listdir(path):
            os.rmdir(path)
    except OSError:
        pass


class DownloadQueue:
    def __init__(self) -> None:
        self._queue: asyncio.Queue[tuple[str, DownloadRequest, str]] = asyncio.Queue()
        self._task: asyncio.Task | None = None

    async def start(self) -> None:
        self._task = asyncio.create_task(self._worker())

    async def stop(self) -> None:
        if self._task:
            self._task.cancel()

    async def enqueue(self, meta: DownloadRequest, batch_dir: str) -> str:
        download_id = str(uuid.uuid4())
        async with async_session_factory() as session:
            from app.models.download import Download

            dl = Download(
                id=download_id,
                url=meta.url,
                title=meta.title,
                artist=meta.artist,
                album=meta.album,
                genre=meta.genre,
                artwork_url=meta.artwork_url,
                status="pending",
                progress=0.0,
                started_at=datetime.utcnow(),
            )
            await AsyncORM.create_download(session, dl)
            await session.commit()

        await self._queue.put((download_id, meta, batch_dir))
        return download_id

    async def _worker(self) -> None:
        loop = asyncio.get_event_loop()
        while True:
            download_id, meta, batch_dir = await self._queue.get()
            try:
                # Already cancelled while waiting in queue
                if download_id in _cancelled_ids:
                    _cancelled_ids.discard(download_id)
                    continue

                await _update_db(download_id, status="downloading", progress=0)
                mp3_path = await loop.run_in_executor(
                    None, _run_download, download_id, meta, loop, batch_dir
                )

                # Cancelled during convert/tag phase (after progress_hook stops firing)
                if download_id in _cancelled_ids:
                    _cancelled_ids.discard(download_id)
                    if os.path.exists(mp3_path):
                        try:
                            os.remove(mp3_path)
                        except OSError:
                            pass
                    await _update_db(
                        download_id,
                        status="cancelled",
                        finished_at=datetime.utcnow(),
                        speed=None,
                    )
                    continue

                await _update_db(
                    download_id,
                    status="done",
                    progress=100,
                    filepath=mp3_path,
                    filename=os.path.basename(mp3_path),
                    finished_at=datetime.utcnow(),
                    speed=None,
                )
                logger.info("Download done: %s", mp3_path)
            except Exception as e:
                if download_id in _cancelled_ids:
                    _cancelled_ids.discard(download_id)
                    _cleanup_partial_files(batch_dir, _safe_filename(meta.title))
                    await _update_db(
                        download_id,
                        status="cancelled",
                        finished_at=datetime.utcnow(),
                        speed=None,
                    )
                    logger.info("Download cancelled: %s", download_id)
                else:
                    logger.error("Download failed [%s]: %s", download_id, e)
                    await _update_db(
                        download_id,
                        status="error",
                        error=str(e),
                        finished_at=datetime.utcnow(),
                        speed=None,
                    )
            finally:
                _cancelled_ids.discard(download_id)
                self._queue.task_done()
                _cleanup_batch_dir_if_empty(batch_dir)

    async def cancel(self, download_id: str) -> None:
        _cancelled_ids.add(download_id)
        await _update_db(
            download_id,
            status="cancelled",
            finished_at=datetime.utcnow(),
            speed=None,
        )


download_queue = DownloadQueue()
