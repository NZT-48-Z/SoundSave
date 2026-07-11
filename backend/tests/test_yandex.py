import pytest

from app.core.exceptions import YandexError
from app.services.yandex import _parse_playlist_url


def test_parse_user_playlist_url():
    kind, user_id = _parse_playlist_url(
        "https://music.yandex.ru/users/alice/playlists/1023"
    )
    assert kind == "1023"
    assert user_id == "alice"


def test_parse_shared_uuid_playlist_url():
    uuid = "550e8400-e29b-41d4-a716-446655440000"
    identifier, user_id = _parse_playlist_url(
        f"https://music.yandex.ru/playlists/{uuid}"
    )
    assert identifier == uuid
    assert user_id is None


def test_parse_user_playlist_takes_precedence_over_uuid_pattern():
    # A user URL must be read as (kind, user), not misparsed as a shared UUID.
    kind, user_id = _parse_playlist_url(
        "https://music.yandex.ru/users/bob/playlists/42"
    )
    assert (kind, user_id) == ("42", "bob")


@pytest.mark.parametrize(
    "url",
    [
        "https://music.yandex.ru/album/123",
        "https://example.com/not-a-playlist",
        "garbage",
    ],
)
def test_parse_invalid_url_raises(url):
    with pytest.raises(YandexError):
        _parse_playlist_url(url)
