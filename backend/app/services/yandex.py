import logging
import re

logger = logging.getLogger(__name__)

_UUID_RE = re.compile(r"playlists/([0-9a-f\-]{36})", re.I)


def _extract_uuid(url: str) -> str | None:
    m = _UUID_RE.search(url)
    return m.group(1) if m else None


def fetch_yandex_playlist(url: str) -> list[dict]:
    """Fetch track metadata from a Yandex Music shared playlist URL."""
    from yandex_music import Client

    uuid = _extract_uuid(url)
    if not uuid:
        raise ValueError("Not a valid Yandex Music shared playlist URL")

    from app.services.yandex_auth import get_stored_token

    token = get_stored_token()
    if not token:
        raise ValueError("YANDEX_NOT_CONNECTED")

    logger.info("Fetching Yandex Music playlist: %s", uuid)

    client = Client(token).init()
    # yandex-music v3: client.playlist(uuid) fetches a shared playlist by UUID
    playlist = client.playlist(uuid)

    if not playlist:
        raise ValueError("Playlist not found or is private")

    tracks = []
    for item in playlist.tracks or []:
        try:
            # In v3, playlist.tracks may be TrackShort objects — fetch full track if needed
            track = (
                item.fetch_track()
                if hasattr(item, "fetch_track") and not hasattr(item, "duration_ms")
                else item
            )

            artists = ", ".join(a.name for a in (track.artists or [])) or "Unknown"
            album = track.albums[0].title if getattr(track, "albums", None) else None
            duration = (
                int(track.duration_ms / 1000)
                if getattr(track, "duration_ms", None)
                else None
            )

            tracks.append(
                {
                    "title": track.title or "Unknown",
                    "artist": artists,
                    "album": album,
                    "duration": duration,
                }
            )
        except Exception as e:
            logger.warning("Skipping track, failed to get info: %s", e)

    logger.info("Fetched %d tracks from Yandex Music playlist", len(tracks))
    return tracks
