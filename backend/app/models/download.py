from datetime import datetime, timezone

from sqlalchemy.orm import Mapped, mapped_column

from app.core.constants import DownloadStatus
from app.database.database import Base


def utcnow() -> datetime:
    """Текущее время UTC с таймзоной (замена устаревшего ``datetime.utcnow``)."""
    return datetime.now(timezone.utc)


class Download(Base):
    """ORM-модель одной загрузки в таблице ``downloads``."""

    __tablename__ = "downloads"

    id: Mapped[str] = mapped_column(primary_key=True)
    url: Mapped[str]
    title: Mapped[str]
    artist: Mapped[str]
    album: Mapped[str | None] = mapped_column(default=None)
    genre: Mapped[str | None] = mapped_column(default=None)
    artwork_url: Mapped[str | None] = mapped_column(default=None)

    status: Mapped[str] = mapped_column(default=DownloadStatus.PENDING)
    progress: Mapped[float] = mapped_column(default=0.0)
    speed: Mapped[float | None] = mapped_column(default=None)
    error: Mapped[str | None] = mapped_column(default=None)
    filepath: Mapped[str | None] = mapped_column(default=None)
    filename: Mapped[str | None] = mapped_column(default=None)

    started_at: Mapped[datetime] = mapped_column(default=utcnow)
    finished_at: Mapped[datetime | None] = mapped_column(default=None)
