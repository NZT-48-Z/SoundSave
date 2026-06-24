import asyncio
import logging

from fastapi import APIRouter, HTTPException, Query
from concurrent.futures import ThreadPoolExecutor

from app.core.exceptions import SoundCloudError
from app.schemas.search import ResolveResponse, SearchResponse, TrackInfo
from app.services.soundcloud import clean_title, is_modified_title, resolve_url, search_alternatives, search_tracks

router = APIRouter()
logger = logging.getLogger(__name__)
_executor = ThreadPoolExecutor(max_workers=4)


@router.get("/search")
async def search(
    q: str = Query(..., min_length=1),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=50),
):
    loop = asyncio.get_event_loop()
    offset = (page - 1) * per_page
    try:
        results = await loop.run_in_executor(
            _executor, search_tracks, q, per_page, offset
        )
        return {
            "results": [TrackInfo(**r) for r in results],
            "page": page,
            "per_page": per_page,
            "has_more": len(results) == per_page,
        }
    except SoundCloudError as e:
        raise HTTPException(status_code=502, detail=e.message)
    except Exception as e:
        logger.error("Search error: %s", e)
        raise HTTPException(status_code=500, detail="Search failed")


@router.get("/alternatives")
async def alternatives(
    title: str = Query(...),
    artist: str = Query(""),
    limit: int = Query(5, ge=1, le=10),
):
    loop = asyncio.get_event_loop()
    try:
        results = await loop.run_in_executor(
            _executor, search_alternatives, title, artist, limit
        )
        return {
            "clean_title": clean_title(title),
            "results": [TrackInfo(**r) for r in results],
        }
    except SoundCloudError as e:
        raise HTTPException(status_code=502, detail=e.message)
    except Exception as e:
        logger.error("Alternatives error: %s", e)
        raise HTTPException(status_code=500, detail="Search failed")


@router.get("/resolve")
async def resolve(url: str = Query(...)):
    loop = asyncio.get_event_loop()
    try:
        result = await loop.run_in_executor(_executor, resolve_url, url)
        return result
    except SoundCloudError as e:
        raise HTTPException(status_code=400, detail=e.message)
    except Exception as e:
        logger.error("Resolve error: %s", e)
        raise HTTPException(status_code=500, detail="Resolve failed")
