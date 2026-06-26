from datetime import datetime

from pydantic import BaseModel


class DownloadRequest(BaseModel):
    url: str
    title: str
    artist: str
    album: str | None = None
    genre: str | None = None
    artwork_url: str | None = None
    artwork_local_path: str | None = None


class BulkDownloadRequest(BaseModel):
    items: list[DownloadRequest]


class DownloadRecord(BaseModel):
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
