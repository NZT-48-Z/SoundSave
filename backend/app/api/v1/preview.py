import asyncio
import logging
from concurrent.futures import ThreadPoolExecutor

from fastapi import APIRouter, HTTPException, Query

from app.core.exceptions import SoundCloudError
from app.services.soundcloud import get_preview_url

router = APIRouter()
logger = logging.getLogger(__name__)
_executor = ThreadPoolExecutor(max_workers=2)


@router.get("/preview")
async def preview(url: str = Query(...)):
    loop = asyncio.get_event_loop()
    try:
        return await loop.run_in_executor(_executor, get_preview_url, url)
    except SoundCloudError as e:
        raise HTTPException(status_code=400, detail=e.message)
    except Exception as e:
        logger.error("Preview error: %s", e)
        raise HTTPException(status_code=500, detail="Preview failed")
