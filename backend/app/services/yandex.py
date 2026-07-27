import logging
import re

from app.core.cache import LockedTTLCache
from app.core.exceptions import YandexError, YandexNotConnectedError

logger = logging.getLogger(__name__)

_playlist_cache = LockedTTLCache(maxsize=64, ttl=600)  # 10 минут

# https://music.yandex.ru/users/<login>/playlists/<kind>  (kind — целое число)
_USER_PLAYLIST_RE = re.compile(r"/users/([^/?#]+)/playlists/(\d+)", re.I)
# https://music.yandex.ru/playlists/lk.<uuid>  (плейлист "Мне нравится")
_LIKES_PLAYLIST_RE = re.compile(r"/playlists/lk\.[0-9a-f-]{36}", re.I)
# https://music.yandex.ru/playlists/<uuid>  (расшаренный плейлист)
_UUID_PLAYLIST_RE = re.compile(r"/playlists/([0-9a-f-]{36})", re.I)

# Сентинел-значение identifier для плейлиста "Мне нравится" (не настоящий playlist,
# а отдельная сущность API — треки с отметкой "Мне нравится" текущего пользователя).
_LIKES_SENTINEL = "__likes__"


def _parse_playlist_url(url: str) -> tuple[str, str | None]:
    """Разбирает URL плейлиста Yandex Music.

    Возвращает ``(kind, user_id)`` для пользовательского плейлиста (числовой kind),
    ``(uuid, None)`` для плейлиста, расшаренного по UUID, или
    ``(_LIKES_SENTINEL, None)`` для плейлиста "Мне нравится" (``lk.<uuid>``).
    Бросает ``YandexError``, если это не похоже на URL плейлиста.
    """
    m = _USER_PLAYLIST_RE.search(url)
    if m:
        user_id, kind = m.group(1), m.group(2)
        return kind, user_id

    if _LIKES_PLAYLIST_RE.search(url):
        return _LIKES_SENTINEL, None

    m = _UUID_PLAYLIST_RE.search(url)
    if m:
        return m.group(1), None

    raise YandexError("Not a valid Yandex Music playlist URL")


def _track_to_dict(track) -> dict:
    """Приводит трек Yandex Music к dict с полями title/artist/album/duration."""
    artists = ", ".join(a.name for a in (track.artists or [])) or "Unknown"
    album = track.albums[0].title if getattr(track, "albums", None) else None
    duration = (
        int(track.duration_ms / 1000) if getattr(track, "duration_ms", None) else None
    )
    return {
        "title": track.title or "Unknown",
        "artist": artists,
        "album": album,
        "duration": duration,
    }


def fetch_yandex_playlist(url: str) -> list[dict]:
    """Загружает метаданные треков плейлиста Yandex Music по URL (кешируется).

    Блокирующая (сеть + keyring) — вызывать из потока пула, а не из event loop.
    """
    return _playlist_cache.get_or_set(url, lambda: _fetch_yandex_playlist_uncached(url))


def _fetch_yandex_playlist_uncached(url: str) -> list[dict]:
    """Тело ``fetch_yandex_playlist`` без кеша."""
    from yandex_music import Client

    from app.services.yandex_auth import get_stored_token

    identifier, user_id = _parse_playlist_url(url)

    token = get_stored_token()
    if not token:
        raise YandexNotConnectedError()

    logger.info("Fetching Yandex Music playlist: %s", identifier)

    client = Client(token).init()
    if identifier == _LIKES_SENTINEL:
        playlist = client.users_likes_tracks()
    elif user_id is None:
        playlist = client.playlist(identifier)
    else:
        playlist = client.users_playlists(identifier, user_id)

    if not playlist:
        raise YandexError("Playlist not found or is private")

    tracks: list[dict] = []
    for item in playlist.tracks or []:
        try:
            # playlist.tracks может содержать объекты TrackShort — берём полный трек.
            track = (
                item.fetch_track()
                if hasattr(item, "fetch_track") and not hasattr(item, "duration_ms")
                else item
            )
            tracks.append(_track_to_dict(track))
        except Exception as e:
            logger.warning("Skipping track, failed to get info: %s", e)

    logger.info("Fetched %d tracks from Yandex Music playlist", len(tracks))
    return tracks
