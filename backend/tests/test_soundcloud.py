import pytest

from app.services import soundcloud
from app.services.soundcloud import (
    _clean_entry,
    clean_title,
    is_modified_title,
    search_alternatives,
)


@pytest.mark.parametrize(
    "title",
    [
        "Song (Slowed + Reverb)",
        "Song - slowed",
        "Song [nightcore]",
        "Song (sped up)",
        "Song (bass boosted)",
    ],
)
def test_clean_title_strips_modifiers(title):
    assert clean_title(title) == "Song"


def test_clean_title_keeps_plain_title():
    assert clean_title("Just A Song") == "Just A Song"


@pytest.mark.parametrize(
    "title,expected",
    [
        ("Track (nightcore)", True),
        ("Track slowed down", True),
        ("Track 8D audio", True),
        ("Track", False),
        ("Original Mix", False),
    ],
)
def test_is_modified_title(title, expected):
    assert is_modified_title(title) is expected


def test_clean_entry_none_without_id():
    assert _clean_entry({}) is None
    assert _clean_entry({"title": "x"}) is None


def test_clean_entry_defaults_and_artwork():
    entry = {
        "id": 123,
        "title": "T",
        "uploader": "U",
        "thumbnails": [{"url": "small"}, {"url": "large"}],
    }
    cleaned = _clean_entry(entry)
    assert cleaned["id"] == "123"  # coerced to str
    assert cleaned["artist"] == "U"
    assert cleaned["artwork_url"] == "large"  # last thumbnail wins


def test_clean_entry_fallback_values():
    cleaned = _clean_entry({"id": 5})
    assert cleaned["title"] == "Unknown Title"
    assert cleaned["artist"] == "Unknown Artist"
    assert cleaned["url"] == ""


def test_search_alternatives_orders_originals_first(monkeypatch):
    fake = [
        {"id": "1", "title": "Song (slowed)", "artist": "A", "url": "u1"},
        {"id": "2", "title": "Song", "artist": "A", "url": "u2"},
        {"id": "3", "title": "Song (nightcore)", "artist": "A", "url": "u3"},
        {"id": "4", "title": "Song Original", "artist": "A", "url": "u4"},
    ]
    monkeypatch.setattr(soundcloud, "search_tracks", lambda q, limit: fake)

    result = search_alternatives("Song (slowed)", "A", limit=4)

    assert [r["id"] for r in result] == ["2", "4", "1", "3"]
