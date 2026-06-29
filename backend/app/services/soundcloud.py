import logging
import re

import yt_dlp

from app.core.exceptions import SoundCloudError

logger = logging.getLogger(__name__)

# Patterns that indicate a modified/non-original track
_MOD_PATTERN = re.compile(
    r"\b(slowed|reverb|sped[\s_-]?up|speed[\s_-]?up|nightcore|8d[\s_-]?audio|"
    r"bass[\s_-]?boost(ed)?|lo[\s_-]?fi|pitched|slowed[\s_-]?down|"
    r"tiktok|tik[\s_-]?tok|phone[\s_-]?quality)\b",
    re.I,
)

# Remove parenthesised / bracketed / dashed modifiers from the end of a title
_CLEAN_PATTERN = re.compile(
    r"[\s\-–]+[\(\[\|]?\s*"
    r"(slowed[\s&+]*reverb|slowed[\s&+]*reverbed|slowed|reverb(ed)?|sped[\s_-]?up|"
    r"speed[\s_-]?up|nightcore|8d[\s_-]?audio|bass[\s_-]?boost(ed)?|"
    r"lo[\s_-]?fi|pitched|slowed[\s_-]?down)"
    r"[^\)\]]*[\)\]]?",
    re.I,
)


def is_modified_title(title: str) -> bool:
    return bool(_MOD_PATTERN.search(title))


def clean_title(title: str) -> str:
    cleaned = _CLEAN_PATTERN.sub("", title)
    return cleaned.strip(" -–|([")


def search_alternatives(title: str, artist: str, limit: int = 6) -> list[dict]:
    """Search for original versions of a track by stripping modifiers from the title."""
    clean = clean_title(title)
    query = f"{artist} {clean}".strip()
    results = search_tracks(query, limit * 2)
    # Put unmodified titles first
    originals = [r for r in results if not is_modified_title(r["title"])]
    modified = [r for r in results if is_modified_title(r["title"])]
    return (originals + modified)[:limit]


_YDL_BASE_OPTS = {
    "quiet": True,
    "no_warnings": True,
    "extract_flat": True,
}


def _clean_entry(entry: dict) -> dict | None:
    if not entry or not entry.get("id"):
        return None

    thumbnails = entry.get("thumbnails") or []
    artwork = thumbnails[-1].get("url") if thumbnails else entry.get("thumbnail")

    return {
        "id": str(entry["id"]),
        "title": entry.get("title") or "Unknown Title",
        "artist": entry.get("uploader") or entry.get("artist") or "Unknown Artist",
        "duration": entry.get("duration"),
        "url": entry.get("webpage_url") or entry.get("url") or "",
        "artwork_url": artwork,
        "genre": entry.get("genre"),
        "view_count": entry.get("view_count"),
    }


def search_tracks(query: str, limit: int = 20, offset: int = 0) -> list[dict]:
    total_needed = offset + limit
    start = offset + 1
    end = offset + limit
    opts = {**_YDL_BASE_OPTS, "playlist_items": f"{start}:{end}"}
    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            result = ydl.extract_info(f"scsearch{total_needed}:{query}", download=False)
            entries = result.get("entries", []) if result else []
            return [c for e in entries if (c := _clean_entry(e))]
    except Exception as e:
        logger.error("SoundCloud search failed: %s", e)
        raise SoundCloudError(str(e)) from e


_YDL_PREVIEW_OPTS = {
    "quiet": True,
    "no_warnings": True,
    # Explicitly exclude HLS/DASH — browsers can't play them natively via Audio API.
    # http_mp3_128k is SoundCloud's progressive MP3; fallbacks require direct HTTP(S).
    "format": "http_mp3_128k/bestaudio[ext=mp3][protocol=https]/bestaudio[protocol=https]/bestaudio[protocol=http]",
}


def get_preview_url(url: str) -> dict:
    try:
        with yt_dlp.YoutubeDL(_YDL_PREVIEW_OPTS) as ydl:
            result = ydl.extract_info(url, download=False)
            if not result:
                raise SoundCloudError("Could not resolve track")

            stream_url = result.get("url")

            if not stream_url:
                formats = result.get("formats") or []
                for fmt in reversed(formats):
                    if fmt.get("protocol") in ("https", "http") and fmt.get(
                        "vcodec"
                    ) in (None, "none"):
                        stream_url = fmt.get("url")
                        break
                if not stream_url and formats:
                    stream_url = formats[-1].get("url")

            if not stream_url:
                raise SoundCloudError("No stream URL available")

            return {"stream_url": stream_url, "duration": result.get("duration")}

    except SoundCloudError:
        raise
    except Exception as e:
        logger.error("Preview fetch failed: %s", e)
        raise SoundCloudError(str(e)) from e


def resolve_url(url: str) -> dict:
    try:
        with yt_dlp.YoutubeDL(_YDL_BASE_OPTS) as ydl:
            result = ydl.extract_info(url, download=False)
            if not result:
                raise SoundCloudError("Could not resolve URL")

            if result.get("_type") == "playlist":
                entries = result.get("entries", [])
                thumbnails = result.get("thumbnails") or []
                artwork = (
                    thumbnails[-1].get("url") if thumbnails else result.get("thumbnail")
                )
                return {
                    "type": "playlist",
                    "title": result.get("title", "Unknown Playlist"),
                    "artist": result.get("uploader", "Unknown"),
                    "artwork_url": artwork,
                    "tracks": [c for e in entries if (c := _clean_entry(e))],
                }

            cleaned = _clean_entry(result)
            if not cleaned:
                raise SoundCloudError("Could not parse track info")
            return {"type": "track", **cleaned}

    except SoundCloudError:
        raise
    except Exception as e:
        logger.error("SoundCloud resolve failed: %s", e)
        raise SoundCloudError(str(e)) from e
