import logging

from fastapi import APIRouter, HTTPException

from app.api.dependencies import DbSession
from app.database.query.orm import AsyncORM
from app.schemas.download import BulkDownloadRequest, DownloadRecord, DownloadRequest
from app.services.downloader import download_queue

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/download/bulk")
async def bulk_download(req: BulkDownloadRequest):
    ids = []
    for item in req.items:
        dl_id = await download_queue.enqueue(item)
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
    count = await AsyncORM.clear_finished_downloads(db)
    return {"deleted": count}
