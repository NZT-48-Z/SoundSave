from urllib.parse import urlparse

from app.core.config import settings


def is_allowed_url(url: str) -> bool:
    """True, если схема ``url`` разрешена (по умолчанию http/https)."""
    try:
        scheme = urlparse(url).scheme.lower()
    except ValueError:
        return False
    return scheme in settings.ALLOWED_URL_SCHEMES


def validate_url(url: str) -> str:
    """Возвращает ``url``, если его схема разрешена, иначе бросает ``ValueError``."""
    if not is_allowed_url(url):
        allowed = ", ".join(sorted(settings.ALLOWED_URL_SCHEMES))
        raise ValueError(f"URL scheme not allowed (must be one of: {allowed})")
    return url
