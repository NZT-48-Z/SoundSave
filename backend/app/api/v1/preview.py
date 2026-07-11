import logging

from fastapi import APIRouter, HTTPException, Query

from app.core.exceptions import SoundCloudError
from app.core.executor import run_blocking
from app.core.validation import is_allowed_url
from app.schemas.search import PreviewResponse
from app.services.soundcloud import get_preview_url

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/preview", response_model=PreviewResponse)
async def preview(url: str = Query(...)):
    """Возвращает прямой stream-URL трека для проигрывания превью в браузере."""
    if not is_allowed_url(url):
        raise HTTPException(status_code=400, detail="URL scheme not allowed")
    try:
        return await run_blocking(get_preview_url, url)
    except SoundCloudError as e:
        raise HTTPException(status_code=400, detail=e.message)
    except Exception as e:
        logger.error("Preview error: %s", e)
        raise HTTPException(status_code=500, detail="Preview failed")
