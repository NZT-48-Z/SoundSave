import pytest

from app.core.validation import is_allowed_url, validate_url


@pytest.mark.parametrize(
    "url,expected",
    [
        ("https://soundcloud.com/x/y", True),
        ("http://example.com", True),
        ("HTTPS://EXAMPLE.COM", True),
        ("ftp://example.com/file", False),
        ("file:///etc/passwd", False),
        ("javascript:alert(1)", False),
        ("not a url", False),
        ("", False),
    ],
)
def test_is_allowed_url(url, expected):
    assert is_allowed_url(url) is expected


def test_validate_url_returns_value_when_allowed():
    assert validate_url("https://example.com") == "https://example.com"


def test_validate_url_raises_when_not_allowed():
    with pytest.raises(ValueError):
        validate_url("ftp://example.com")
