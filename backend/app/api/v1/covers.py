import logging
import os
import uuid

from fastapi import APIRouter, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse

from app.core.config import settings
from app.core.executor import run_blocking

router = APIRouter()
logger = logging.getLogger(__name__)

_EXT_TO_MIME = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png", 
    ".webp": "image/webp",
}
_CHUNK_SIZE = 1024 * 1024


def _write_bytes(path: str, data: bytes) -> None:
    """Синхронно пишет байты в файл (для оффлоада в пул потоков)."""
    with open(path, "wb") as f:
        f.write(data)


@router.post("/upload/cover")
async def upload_cover(file: UploadFile, request: Request):
    """Принимает изображение обложки (с лимитом размера) и возвращает его URL."""
    ext = os.path.splitext(file.filename or "cover.jpg")[1].lower() or ".jpg"
    if ext not in _EXT_TO_MIME:
        raise HTTPException(status_code=400, detail="Only JPEG/PNG/WebP images allowed")

    # Читаем ограниченными кусками, чтобы слишком большая загрузка не съела память.
    max_bytes = settings.max_cover_upload_bytes
    chunks: list[bytes] = []
    size = 0
    while chunk := await file.read(_CHUNK_SIZE):
        size += len(chunk)
        if size > max_bytes:
            raise HTTPException(
                status_code=413,
                detail=f"File too large (max {settings.MAX_COVER_UPLOAD_MB} MB)",
            )
        chunks.append(chunk)

    filename = f"{uuid.uuid4().hex}{ext}"
    dest = os.path.join(settings.covers_path, filename)
    await run_blocking(_write_bytes, dest, b"".join(chunks))

    base = str(request.base_url).rstrip("/")
    return {"url": f"{base}/api/v1/covers/{filename}", "path": dest}


@router.get("/covers/{filename}")
async def serve_cover(filename: str):
    """Отдаёт файл обложки по имени (с защитой от path traversal)."""
    # os.path.basename отбрасывает компоненты пути, защищая от path traversal.
    safe = os.path.basename(filename)
    path = os.path.join(settings.covers_path, safe)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Not found")
    return FileResponse(path)
