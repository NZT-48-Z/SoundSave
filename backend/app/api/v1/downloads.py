import logging
import os
from datetime import datetime

from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from app.api.dependencies import DbSession
from app.api.v1.covers import COVERS_DIR
from app.database.query.orm import AsyncORM
from app.models.download import Download
from app.schemas.download import BulkDownloadRequest, DownloadRecord, DownloadRequest
from app.services.downloader import download_queue

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/download/bulk")
async def bulk_download(req: BulkDownloadRequest):
    batch_dir = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    ids = []
    for item in req.items:
        dl_id = await download_queue.enqueue(item, batch_dir)
        ids.append(dl_id)
    return {"ids": ids, "count": len(ids)}


@router.get("/downloads", response_model=list[DownloadRecord])
async def list_downloads(db: DbSession):
    rows = await AsyncORM.get_all_downloads(db)
    return [DownloadRecord.model_validate(r) for r in rows]


@router.get("/downloads/{download_id}", response_model=DownloadRecord)
async def get_download(download_id: str, db: DbSession):
    row = await AsyncORM.get_download(db, download_id)
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    return DownloadRecord.model_validate(row)


@router.post("/downloads/{download_id}/cancel")
async def cancel_download(download_id: str, db: DbSession):
    row = await AsyncORM.get_download(db, download_id)
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    if row.status in ("done", "error", "cancelled"):
        raise HTTPException(status_code=409, detail="Already finished")
    await download_queue.cancel(download_id)
    return {"ok": True}


@router.delete("/downloads")
async def clear_history(db: DbSession):
    _CLEAR_STATUSES = {"done", "error", "cancelled", "downloading", "converting", "tagging"}
    result = await db.execute(
        select(Download.artwork_url).where(Download.status.in_(_CLEAR_STATUSES))
    )
    cover_urls = [row[0] for row in result if row[0] and "/api/v1/covers/" in row[0]]

    count = await AsyncORM.clear_finished_downloads(db)

    for url in cover_urls:
        filename = os.path.basename(url.split("/api/v1/covers/")[-1])
        path = os.path.join(COVERS_DIR, filename)
        try:
            os.remove(path)
        except OSError:
            pass

    return {"deleted": count}
