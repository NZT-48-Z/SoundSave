import asyncio
import logging
from concurrent.futures import ThreadPoolExecutor

from fastapi import APIRouter, HTTPException, Query

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
_executor = ThreadPoolExecutor(max_workers=6)


@router.get("/import/yandex/auth/status")
async def yandex_auth_status():
    """Check if a Yandex Music token is already stored."""
    token = get_stored_token()
    return {"connected": token is not None}


@router.post("/import/yandex/auth/start")
async def yandex_auth_start():
    """Begin Device Auth flow. Returns user_code + verification_url."""
    try:
        info = await start_device_auth()
        return info
    except Exception as e:
        logger.error("Failed to start Yandex device auth: %s", e)
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/import/yandex/auth/poll/{session_id}")
async def yandex_auth_poll(session_id: str):
    """Poll whether the device auth has been confirmed."""
    session = get_session_status(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"status": session["status"], "error": session.get("error")}


@router.delete("/import/yandex/auth")
async def yandex_auth_disconnect():
    """Remove the stored Yandex token."""
    delete_token()
    return {"ok": True}


@router.get("/import/yandex")
async def import_yandex(url: str = Query(...)):
    loop = asyncio.get_running_loop()

    # 1. Fetch Yandex Music playlist metadata
    try:
        ym_tracks = await loop.run_in_executor(_executor, fetch_yandex_playlist, url)
    except ValueError as e:
        if "YANDEX_NOT_CONNECTED" in str(e):
            raise HTTPException(status_code=401, detail="YANDEX_NOT_CONNECTED")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Yandex Music fetch failed: %s", e)
        raise HTTPException(status_code=502, detail=f"Yandex Music error: {e}")

    if not ym_tracks:
        return {"results": [], "total": 0, "found": 0}

    # 2. Search SoundCloud for each track in parallel (max 5 concurrent)
    sem = asyncio.Semaphore(5)

    async def find_on_soundcloud(ym_track: dict) -> dict | None:
        async with sem:
            query = f"{ym_track['artist']} {ym_track['title']}"
            try:
                results = await loop.run_in_executor(_executor, search_tracks, query, 1)
                if not results:
                    logger.info("Not found on SoundCloud: %s", query)
                    return None
                sc = results[0]
                # Pre-fill album from Yandex metadata
                if ym_track.get('album'):
                    sc['album'] = ym_track['album']
                sc['_ym_title'] = ym_track['title']
                sc['_ym_artist'] = ym_track['artist']
                return sc
            except Exception as e:
                logger.warning("SoundCloud search failed for '%s': %s", query, e)
                return None

    tasks = [find_on_soundcloud(t) for t in ym_tracks]
    sc_results = await asyncio.gather(*tasks)

    found = [r for r in sc_results if r is not None]
    not_found = len(ym_tracks) - len(found)

    logger.info(
        "Yandex import: %d/%d tracks found on SoundCloud (%d not found)",
        len(found), len(ym_tracks), not_found,
    )

    return {
        "results": found,
        "total": len(ym_tracks),
        "found": len(found),
        "not_found": not_found,
    }
