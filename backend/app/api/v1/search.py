import logging

from fastapi import APIRouter, HTTPException, Query

from app.core.concurrency import bounded_gather
from app.core.exceptions import SoundCloudError
from app.core.executor import run_blocking
from app.core.validation import is_allowed_url
from app.schemas.search import (
    AlternativesResponse,
    BatchImportItem,
    BatchImportRequest,
    BatchImportResponse,
    BatchImportResultItem,
    ResolveResponse,
    SearchResultsResponse,
    TrackInfo,
)
from app.services.soundcloud import (
    clean_title,
    resolve_url,
    search_alternatives,
    search_tracks,
)

router = APIRouter()
logger = logging.getLogger(__name__)

_BATCH_CONCURRENCY = 4


@router.get("/search", response_model=SearchResultsResponse)
async def search(
    q: str = Query(..., min_length=1),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=50),
):
    """Поиск треков на SoundCloud по тексту с постраничной выдачей."""
    offset = (page - 1) * per_page
    try:
        results = await run_blocking(search_tracks, q, per_page, offset)
    except SoundCloudError as e:
        raise HTTPException(status_code=502, detail=e.message)
    except Exception as e:
        logger.error("Search error: %s", e)
        raise HTTPException(status_code=500, detail="Search failed")

    return SearchResultsResponse(
        results=[TrackInfo(**r) for r in results],
        page=page,
        per_page=per_page,
        has_more=len(results) == per_page,
    )


@router.get("/alternatives", response_model=AlternativesResponse)
async def alternatives(
    title: str = Query(...),
    artist: str = Query(""),
    limit: int = Query(5, ge=1, le=10),
):
    """Ищет оригинальные версии трека по очищенному от модификаторов названию."""
    try:
        results = await run_blocking(search_alternatives, title, artist, limit)
    except SoundCloudError as e:
        raise HTTPException(status_code=502, detail=e.message)
    except Exception as e:
        logger.error("Alternatives error: %s", e)
        raise HTTPException(status_code=500, detail="Search failed")

    return AlternativesResponse(
        clean_title=clean_title(title),
        results=[TrackInfo(**r) for r in results],
    )


async def _resolve_item(item: BatchImportItem) -> TrackInfo | None:
    """Резолвит один элемент батч-импорта в трек (или None, если не найден)."""
    if item.type == "url":
        if not is_allowed_url(item.value):
            raise ValueError("URL scheme not allowed")
        result = await run_blocking(resolve_url, item.value)
        if result.get("type") == "playlist":
            tracks = result.get("tracks") or []
            # URL плейлиста даёт много треков, но UI импорта ждёт один трек
            # на вставленную строку, поэтому берём первый.
            return TrackInfo(**tracks[0]) if tracks else None
        result.pop("type", None)
        return TrackInfo(**result) if result.get("id") else None

    results = await run_blocking(search_tracks, item.value, 1, 0)
    return TrackInfo(**results[0]) if results else None


@router.post("/import/batch", response_model=BatchImportResponse)
async def import_batch(req: BatchImportRequest):
    """Резолвит список элементов (URL/запросы) в треки с ограниченной конкурентностью."""

    async def resolve_one(item: BatchImportItem) -> BatchImportResultItem:
        """Оборачивает резолв одного элемента, не роняя весь батч при ошибке."""
        try:
            track = await _resolve_item(item)
            return BatchImportResultItem(value=item.value, track=track)
        except Exception as e:
            logger.error("Batch import error for %s: %s", item.value, e)
            return BatchImportResultItem(value=item.value, error=str(e))

    results = await bounded_gather(req.items, resolve_one, limit=_BATCH_CONCURRENCY)
    found = sum(1 for r in results if r.track)
    return BatchImportResponse(
        results=results, found=found, not_found=len(results) - found
    )


@router.get("/resolve", response_model=ResolveResponse)
async def resolve(url: str = Query(...)):
    """Резолвит SoundCloud/любой URL в трек или плейлист."""
    if not is_allowed_url(url):
        raise HTTPException(status_code=400, detail="URL scheme not allowed")
    try:
        return await run_blocking(resolve_url, url)
    except SoundCloudError as e:
        raise HTTPException(status_code=400, detail=e.message)
    except Exception as e:
        logger.error("Resolve error: %s", e)
        raise HTTPException(status_code=500, detail="Resolve failed")
