import logging
from typing import Sequence

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import IN_PROGRESS_STATUSES, TERMINAL_STATUSES, DownloadStatus
from app.models.download import Download, utcnow

logger = logging.getLogger(__name__)


class AsyncORM:
    """Репозиторий доступа к таблице ``downloads`` (все методы принимают сессию)."""

    @staticmethod
    async def create_download(db: AsyncSession, download: Download) -> Download:
        """Добавляет новую запись загрузки и возвращает её."""
        db.add(download)
        await db.flush()
        await db.refresh(download)
        return download

    @staticmethod
    async def get_download(db: AsyncSession, download_id: str) -> Download | None:
        """Возвращает загрузку по id или ``None``, если её нет."""
        result = await db.execute(select(Download).where(Download.id == download_id))
        return result.scalar_one_or_none()

    @staticmethod
    async def get_all_downloads(db: AsyncSession) -> Sequence[Download]:
        """Возвращает все загрузки, новые первыми (по ``started_at``)."""
        result = await db.execute(select(Download).order_by(Download.started_at.desc()))
        return result.scalars().all()

    @staticmethod
    async def update_download(db: AsyncSession, download_id: str, **fields) -> None:
        """Обновляет переданные поля записи загрузки по id."""
        await db.execute(
            update(Download).where(Download.id == download_id).values(**fields)
        )
        await db.flush()

    @staticmethod
    async def mark_cancelled_if_pending(db: AsyncSession, download_id: str) -> int:
        """Отменяет задачу, пока она ещё в очереди (``pending``).

        Условие ``status == PENDING`` делает вызов no-op, как только воркер начал
        задачу, поэтому он никогда не гонится с финальной записью воркера — воркер
        остаётся единственным владельцем статуса выполняемой им загрузки.
        """
        result = await db.execute(
            update(Download)
            .where(
                Download.id == download_id,
                Download.status == DownloadStatus.PENDING,
            )
            .values(
                status=DownloadStatus.CANCELLED,
                finished_at=utcnow(),
                speed=None,
            )
        )
        await db.flush()
        return result.rowcount

    @staticmethod
    async def clear_finished_downloads(db: AsyncSession) -> int:
        """Удаляет завершённые записи (done/error/cancelled), возвращает их число."""
        result = await db.execute(
            delete(Download).where(Download.status.in_(TERMINAL_STATUSES))
        )
        await db.flush()
        return result.rowcount

    @staticmethod
    async def reset_stale_downloads(db: AsyncSession) -> int:
        """При старте: помечает прерванные незавершённые записи как error."""
        result = await db.execute(
            update(Download)
            .where(Download.status.in_(IN_PROGRESS_STATUSES))
            .values(
                status=DownloadStatus.ERROR,
                error="Interrupted — server was restarted",
            )
        )
        await db.flush()
        return result.rowcount
