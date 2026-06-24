import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.core.config import settings
from app.core.logger import configure_logging
from app.database.database import async_session_factory, create_tables
from app.database.query.orm import AsyncORM
from app.services.downloader import download_queue

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging()

    download_dir = os.path.expanduser(settings.DOWNLOAD_DIR)
    os.makedirs(download_dir, exist_ok=True)
    logger.info("Download directory: %s", download_dir)

    await create_tables()
    logger.info("Database ready: %s", settings.DB_PATH)

    async with async_session_factory() as session:
        count = await AsyncORM.reset_stale_downloads(session)
        await session.commit()
        if count:
            logger.info("Reset %d stale downloads from previous session", count)

    await download_queue.start()
    logger.info("Download worker started")

    logger.info("SoundSave API started on port %s", settings.PORT)

    yield

    await download_queue.stop()
    logger.info("SoundSave API shutting down")
