import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.core.config import settings
from app.core.executor import init_executor, shutdown_executor
from app.core.keyring_backend import init_keyring
from app.database.database import async_session_factory, create_tables
from app.database.query.orm import AsyncORM
from app.services.downloader import download_queue

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Инициализация при старте и корректное завершение приложения."""
    init_keyring()

    os.makedirs(settings.download_path, exist_ok=True)
    os.makedirs(settings.covers_path, exist_ok=True)
    logger.info("Download directory: %s", settings.download_path)

    init_executor()

    await create_tables()
    logger.info("Database ready: %s", settings.db_path_abs)

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
    shutdown_executor()
    logger.info("SoundSave API shutting down")
