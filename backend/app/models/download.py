from datetime import datetime

from sqlalchemy.orm import Mapped, mapped_column

from app.database.database import Base


class Download(Base):
    __tablename__ = "downloads"

    id: Mapped[str] = mapped_column(primary_key=True)
    url: Mapped[str]
    title: Mapped[str]
    artist: Mapped[str]
    album: Mapped[str | None] = mapped_column(default=None)
    genre: Mapped[str | None] = mapped_column(default=None)
    artwork_url: Mapped[str | None] = mapped_column(default=None)

    status: Mapped[str] = mapped_column(default="pending")
    progress: Mapped[float] = mapped_column(default=0.0)
    speed: Mapped[float | None] = mapped_column(default=None)
    error: Mapped[str | None] = mapped_column(default=None)
    filepath: Mapped[str | None] = mapped_column(default=None)
    filename: Mapped[str | None] = mapped_column(default=None)

    started_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    finished_at: Mapped[datetime | None] = mapped_column(default=None)
