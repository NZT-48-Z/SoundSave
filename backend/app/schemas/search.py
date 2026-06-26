from typing import Literal
from pydantic import BaseModel


class TrackInfo(BaseModel):
    id: str
    title: str
    artist: str
    duration: float | None = None
    url: str
    artwork_url: str | None = None
    genre: str | None = None
    view_count: int | None = None


class SearchResponse(BaseModel):
    results: list[TrackInfo]


class ResolveResponse(BaseModel):
    type: str  # "track" | "playlist"
    id: str | None = None
    title: str | None = None
    artist: str | None = None
    duration: float | None = None
    url: str | None = None
    artwork_url: str | None = None
    genre: str | None = None
    tracks: list[TrackInfo] | None = None


class BatchImportItem(BaseModel):
    type: Literal['url', 'query']
    value: str


class BatchImportRequest(BaseModel):
    items: list[BatchImportItem]


class BatchImportResultItem(BaseModel):
    value: str
    track: TrackInfo | None = None
    error: str | None = None
