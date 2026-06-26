import logging
from typing import Sequence

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.download import Download

logger = logging.getLogger(__name__)


class AsyncORM:
    @staticmethod
    async def create_download(db: AsyncSession, download: Download) -> Download:
        db.add(download)
        await db.flush()
        await db.refresh(download)
        return download

    @staticmethod
    async def get_download(db: AsyncSession, download_id: str) -> Download | None:
        result = await db.execute(select(Download).where(Download.id == download_id))
        return result.scalar_one_or_none()

    @staticmethod
    async def get_all_downloads(db: AsyncSession) -> Sequence[Download]:
        result = await db.execute(
            select(Download).order_by(Download.started_at.desc())
        )
        return result.scalars().all()

    @staticmethod
    async def update_download(db: AsyncSession, download_id: str, **fields) -> None:
        await db.execute(
            update(Download).where(Download.id == download_id).values(**fields)
        )
        await db.flush()

    @staticmethod
    async def clear_finished_downloads(db: AsyncSession) -> int:
        result = await db.execute(
            delete(Download).where(Download.status.in_(["done", "error", "cancelled"]))
        )
        await db.flush()
        return result.rowcount

    @staticmethod
    async def reset_stale_downloads(db: AsyncSession) -> int:
        """On startup: mark any interrupted in-progress records as error."""
        result = await db.execute(
            update(Download)
            .where(Download.status.in_(["downloading", "converting", "tagging", "pending"]))
            .values(status="error", error="Interrupted — server was restarted")
        )
        await db.flush()
        return result.rowcount
