from fastapi import APIRouter

from app.api.v1.covers import router as covers_router
from app.api.v1.downloads import router as downloads_router
from app.api.v1.import_ import router as import_router
from app.api.v1.preview import router as preview_router
from app.api.v1.search import router as search_router

router = APIRouter(prefix="/api/v1")
router.include_router(search_router)
router.include_router(downloads_router)
router.include_router(import_router)
router.include_router(covers_router)
router.include_router(preview_router)
