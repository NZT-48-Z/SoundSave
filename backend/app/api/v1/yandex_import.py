import logging

from fastapi import APIRouter, HTTPException, Query

from app.core.concurrency import bounded_gather
from app.core.exceptions import YandexError, YandexNotConnectedError
from app.core.executor import run_blocking
from app.core.validation import is_allowed_url
from app.schemas.search import TrackInfo, YandexImportResponse, YandexNotFoundTrack
from app.services.soundcloud import search_tracks
from app.services.yandex import fetch_yandex_playlist
from app.services.yandex_auth import (
    delete_token,
    get_session_status,
    get_stored_token,
    start_device_auth,
)

router = APIRouter()
logger = logging.getLogger(__name__)

_SC_CONCURRENCY = 5


@router.get("/import/yandex/auth/status")
async def yandex_auth_status():
    """Проверяет, сохранён ли уже токен Yandex Music."""
    token = await run_blocking(get_stored_token)
    return {"connected": token is not None}


@router.post("/import/yandex/auth/start")
async def yandex_auth_start():
    """Запускает device-flow авторизации. Возвращает user_code + verification_url."""
    try:
        return await start_device_auth()
    except Exception as e:
        logger.error("Failed to start Yandex device auth: %s", e)
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/import/yandex/auth/poll/{session_id}")
async def yandex_auth_poll(session_id: str):
    """Опрашивает, подтверждена ли device-авторизация."""
    session = get_session_status(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"status": session["status"], "error": session.get("error")}


@router.delete("/import/yandex/auth")
async def yandex_auth_disconnect():
    """Удаляет сохранённый токен Yandex."""
    await run_blocking(delete_token)
    return {"ok": True}


@router.get("/import/yandex", response_model=YandexImportResponse)
async def import_yandex(url: str = Query(...)):
    """Импортирует плейлист Yandex Music и ищет каждый трек на SoundCloud."""
    if not is_allowed_url(url):
        raise HTTPException(status_code=400, detail="URL scheme not allowed")

    # 1. Получаем метаданные плейлиста Yandex Music.
    try:
        ym_tracks = await run_blocking(fetch_yandex_playlist, url)
    except YandexNotConnectedError:
        raise HTTPException(status_code=401, detail="YANDEX_NOT_CONNECTED")
    except YandexError as e:
        raise HTTPException(status_code=400, detail=e.message)
    except Exception as e:
        logger.error("Yandex Music fetch failed: %s", e)
        raise HTTPException(status_code=502, detail=f"Yandex Music error: {e}")

    if not ym_tracks:
        return YandexImportResponse(results=[], total=0, found=0)

    # 2. Ищем каждый трек на SoundCloud (с ограниченной конкурентностью).
    async def find_on_soundcloud(ym_track: dict) -> TrackInfo | None:
        """Ищет один трек Яндекса на SoundCloud, подставляя альбом из метаданных."""
        query = f"{ym_track['artist']} {ym_track['title']}"
        try:
            results = await run_blocking(search_tracks, query, 1)
            if not results:
                logger.info("Not found on SoundCloud: %s", query)
                return None
            sc = results[0]
            if ym_track.get("album"):
                sc["album"] = ym_track["album"]
            return TrackInfo(**sc)
        except Exception as e:
            logger.warning("SoundCloud search failed for '%s': %s", query, e)
            return None

    sc_results = await bounded_gather(
        ym_tracks, find_on_soundcloud, limit=_SC_CONCURRENCY
    )

    found = [t for t in sc_results if t is not None]
    not_found_tracks = [
        YandexNotFoundTrack(title=ym["title"], artist=ym["artist"])
        for ym, t in zip(ym_tracks, sc_results)
        if t is None
    ]

    logger.info(
        "Yandex import: %d/%d tracks found on SoundCloud (%d not found)",
        len(found),
        len(ym_tracks),
        len(not_found_tracks),
    )

    return YandexImportResponse(
        results=found,
        total=len(ym_tracks),
        found=len(found),
        not_found=len(not_found_tracks),
        not_found_tracks=not_found_tracks,
    )
