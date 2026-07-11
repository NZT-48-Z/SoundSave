import logging
import os
from datetime import datetime

from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from app.api.dependencies import DbSession
from app.core.config import settings
from app.core.constants import TERMINAL_STATUSES
from app.database.query.orm import AsyncORM
from app.models.download import Download
from app.schemas.download import BulkDownloadRequest, DownloadRecord
from app.services.downloader import download_queue

router = APIRouter()
logger = logging.getLogger(__name__)

_COVERS_URL_MARKER = "/api/v1/covers/"


@router.post("/download/bulk")
async def bulk_download(req: BulkDownloadRequest):
    """Ставит пачку треков в очередь загрузки, возвращает их id."""
    batch_dir = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    ids = [await download_queue.enqueue(item, batch_dir) for item in req.items]
    return {"ids": ids, "count": len(ids)}


@router.get("/downloads", response_model=list[DownloadRecord])
async def list_downloads(db: DbSession):
    """Возвращает все загрузки (для поллинга прогресса фронтендом)."""
    rows = await AsyncORM.get_all_downloads(db)
    return [DownloadRecord.model_validate(r) for r in rows]


@router.get("/downloads/{download_id}", response_model=DownloadRecord)
async def get_download(download_id: str, db: DbSession):
    """Возвращает одну загрузку по id или 404, если её нет."""
    row = await AsyncORM.get_download(db, download_id)
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    return DownloadRecord.model_validate(row)


@router.post("/downloads/{download_id}/cancel")
async def cancel_download(download_id: str, db: DbSession):
    """Отменяет незавершённую загрузку (409, если она уже в терминальном статусе)."""
    row = await AsyncORM.get_download(db, download_id)
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    if row.status in TERMINAL_STATUSES:
        raise HTTPException(status_code=409, detail="Already finished")
    await download_queue.cancel(download_id)
    return {"ok": True}


@router.delete("/downloads")
async def clear_history(db: DbSession):
    """Очищает завершённые загрузки и удаляет связанные файлы обложек."""
    result = await db.execute(
        select(Download.artwork_url).where(Download.status.in_(TERMINAL_STATUSES))
    )
    cover_urls = [
        row[0] for row in result if row[0] and _COVERS_URL_MARKER in row[0]
    ]

    count = await AsyncORM.clear_finished_downloads(db)

    for url in cover_urls:
        filename = os.path.basename(url.split(_COVERS_URL_MARKER)[-1])
        path = os.path.join(settings.covers_path, filename)
        try:
            os.remove(path)
        except OSError:
            pass

    return {"deleted": count}
