import os
import uuid

from fastapi import APIRouter, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse

from app.core.config import settings

router = APIRouter()

COVERS_DIR = os.path.join(os.path.expanduser(settings.DOWNLOAD_DIR), ".covers")
os.makedirs(COVERS_DIR, exist_ok=True)

_EXT_TO_MIME = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}


@router.post("/upload/cover")
async def upload_cover(file: UploadFile, request: Request):
    ext = os.path.splitext(file.filename or "cover.jpg")[1].lower() or ".jpg"
    if ext not in _EXT_TO_MIME:
        raise HTTPException(status_code=400, detail="Only JPEG/PNG/WebP images allowed")
    filename = f"{uuid.uuid4().hex}{ext}"
    dest = os.path.join(COVERS_DIR, filename)

    content = await file.read()
    with open(dest, "wb") as f:
        f.write(content)

    base = str(request.base_url).rstrip("/")
    return {"url": f"{base}/api/v1/covers/{filename}", "path": dest}


@router.get("/covers/{filename}")
async def serve_cover(filename: str):
    # Prevent path traversal
    safe = os.path.basename(filename)
    path = os.path.join(COVERS_DIR, safe)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Not found")
    return FileResponse(path)
