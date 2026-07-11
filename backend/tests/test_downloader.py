import os

import pytest

from app.core.constants import (
    IN_PROGRESS_STATUSES,
    TERMINAL_STATUSES,
    DownloadStatus,
)
from app.core.exceptions import DownloadError
from app.services.downloader import (
    _clean_error,
    _cut_audio,
    _resolve_mp3_path,
    _safe_filename,
)


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("bad/name:file*?.mp3", "bad_name_file__.mp3"),
        ('a"b<c>d|e', "a_b_c_d_e"),
        ("  spaced  ", "spaced"),
    ],
)
def test_safe_filename(raw, expected):
    assert _safe_filename(raw) == expected


def test_clean_error_strips_ansi_and_prefix():
    assert _clean_error("\x1b[31mERROR: something bad\x1b[0m") == "something bad"


def test_clean_error_detects_drm():
    msg = _clean_error("ERROR: This track is DRM protected blah")
    assert msg == "DRM protected — requires SoundCloud Go+ subscription"


def test_resolve_mp3_path_from_found_path():
    assert _resolve_mp3_path(
        os.path.join("dir", "track.webp"), "dir", "track"
    ) == os.path.join("dir", "track.mp3")


def test_resolve_mp3_path_fallback():
    assert _resolve_mp3_path(None, "dir", "My Song") == os.path.join(
        "dir", "My Song.mp3"
    )


@pytest.mark.parametrize("start,end", [(60.0, 30.0), (30.0, 30.0)])
def test_cut_audio_rejects_invalid_range(start, end):
    # Validation happens before ffmpeg is invoked, so no subprocess runs.
    with pytest.raises(DownloadError):
        _cut_audio("nonexistent.mp3", start, end)


def test_download_status_values():
    assert DownloadStatus.DONE == "done"
    assert DownloadStatus.DOWNLOADING == "downloading"


def test_status_sets_are_disjoint_and_complete():
    assert IN_PROGRESS_STATUSES.isdisjoint(TERMINAL_STATUSES)
    assert IN_PROGRESS_STATUSES | TERMINAL_STATUSES == set(DownloadStatus)
    assert DownloadStatus.PENDING in IN_PROGRESS_STATUSES
    assert DownloadStatus.CANCELLED in TERMINAL_STATUSES
