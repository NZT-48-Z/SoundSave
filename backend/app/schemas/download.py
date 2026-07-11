from datetime import datetime

from pydantic import BaseModel, field_validator, model_validator

from app.core.validation import validate_url


class DownloadRequest(BaseModel):
    """Запрос на загрузку трека с метаданными и опциональной обрезкой."""

    url: str
    title: str
    artist: str
    album: str | None = None
    genre: str | None = None
    artwork_url: str | None = None
    artwork_local_path: str | None = None
    cut_start: float | None = None
    cut_end: float | None = None

    @field_validator("url")
    @classmethod
    def _validate_url(cls, v: str) -> str:
        """Проверяет, что схема URL разрешена (http/https)."""
        return validate_url(v)

    @model_validator(mode="after")
    def _validate_cut_range(self) -> "DownloadRequest":
        """Проверяет корректность границ обрезки (неотрицательны, start < end)."""
        if self.cut_start is not None and self.cut_start < 0:
            raise ValueError("cut_start must be >= 0")
        if self.cut_end is not None and self.cut_end < 0:
            raise ValueError("cut_end must be >= 0")
        if (
            self.cut_start is not None
            and self.cut_end is not None
            and self.cut_start >= self.cut_end
        ):
            raise ValueError("cut_start must be < cut_end")
        return self


class BulkDownloadRequest(BaseModel):
    """Запрос массовой загрузки — список треков."""

    items: list[DownloadRequest]


class DownloadRecord(BaseModel):
    """Представление строки загрузки из БД для ответа API."""

    id: str
    url: str
    title: str
    artist: str
    album: str | None
    genre: str | None
    artwork_url: str | None
    status: str
    progress: float
    speed: float | None
    error: str | None
    filepath: str | None
    filename: str | None
    started_at: datetime
    finished_at: datetime | None

    model_config = {"from_attributes": True}
