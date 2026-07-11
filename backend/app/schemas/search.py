from typing import Literal

from pydantic import BaseModel


class TrackInfo(BaseModel):
    """Единое описание трека, возвращаемое поиском и резолвом."""

    id: str
    title: str
    artist: str
    duration: float | None = None
    url: str
    artwork_url: str | None = None
    genre: str | None = None
    view_count: int | None = None
    album: str | None = None


class SearchResultsResponse(BaseModel):
    """Ответ поиска: страница треков с флагом наличия следующей."""

    results: list[TrackInfo]
    page: int
    per_page: int
    has_more: bool


class AlternativesResponse(BaseModel):
    """Ответ с альтернативами: очищенное название и найденные варианты."""

    clean_title: str
    results: list[TrackInfo]


class ResolveResponse(BaseModel):
    """Результат резолва URL — одиночный трек или плейлист."""

    type: str  # "track" | "playlist"
    id: str | None = None
    title: str | None = None
    artist: str | None = None
    duration: float | None = None
    url: str | None = None
    artwork_url: str | None = None
    genre: str | None = None
    view_count: int | None = None
    album: str | None = None
    tracks: list[TrackInfo] | None = None


class PreviewResponse(BaseModel):
    """Ответ превью: прямой stream-URL и длительность трека."""

    stream_url: str
    duration: float | None = None


class BatchImportItem(BaseModel):
    """Один элемент батч-импорта: URL или текстовый запрос."""

    type: Literal["url", "query"]
    value: str


class BatchImportRequest(BaseModel):
    """Запрос батч-импорта — список элементов на резолв."""

    items: list[BatchImportItem]


class BatchImportResultItem(BaseModel):
    """Результат резолва одного элемента: найденный трек или ошибка."""

    value: str
    track: TrackInfo | None = None
    error: str | None = None


class BatchImportResponse(BaseModel):
    """Ответ батч-импорта: результаты и счётчики найдено/не найдено."""

    results: list[BatchImportResultItem]
    found: int
    not_found: int


class YandexNotFoundTrack(BaseModel):
    """Трек из плейлиста Яндекса, не найденный на SoundCloud."""

    title: str
    artist: str


class YandexImportResponse(BaseModel):
    """Ответ импорта из Яндекса: найденные треки, счётчики и ненайденные."""

    results: list[TrackInfo]
    total: int
    found: int
    not_found: int = 0
    not_found_tracks: list[YandexNotFoundTrack] = []
