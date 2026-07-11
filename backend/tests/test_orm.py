from datetime import datetime, timedelta, timezone

from app.core.constants import DownloadStatus
from app.database.query.orm import AsyncORM
from app.models.download import Download


def _make(download_id: str, status: DownloadStatus, started_at=None) -> Download:
    return Download(
        id=download_id,
        url="https://example.com/track",
        title="Title",
        artist="Artist",
        status=status,
        started_at=started_at or datetime.now(timezone.utc),
    )


async def _add(session_factory, *downloads: Download) -> None:
    async with session_factory() as session:
        for dl in downloads:
            await AsyncORM.create_download(session, dl)
        await session.commit()


async def test_create_and_get(session_factory):
    await _add(session_factory, _make("a", DownloadStatus.PENDING))
    async with session_factory() as session:
        row = await AsyncORM.get_download(session, "a")
    assert row is not None
    assert row.id == "a"
    assert row.status == DownloadStatus.PENDING


async def test_get_missing_returns_none(session_factory):
    async with session_factory() as session:
        assert await AsyncORM.get_download(session, "missing") is None


async def test_get_all_ordered_by_started_desc(session_factory):
    now = datetime.now(timezone.utc)
    await _add(
        session_factory,
        _make("old", DownloadStatus.DONE, now - timedelta(hours=2)),
        _make("new", DownloadStatus.DONE, now),
        _make("mid", DownloadStatus.DONE, now - timedelta(hours=1)),
    )
    async with session_factory() as session:
        rows = await AsyncORM.get_all_downloads(session)
    assert [r.id for r in rows] == ["new", "mid", "old"]


async def test_update_download(session_factory):
    await _add(session_factory, _make("a", DownloadStatus.DOWNLOADING))
    async with session_factory() as session:
        await AsyncORM.update_download(
            session, "a", status=DownloadStatus.DONE, progress=100
        )
        await session.commit()
    async with session_factory() as session:
        row = await AsyncORM.get_download(session, "a")
    assert row.status == DownloadStatus.DONE
    assert row.progress == 100


async def test_clear_finished_keeps_in_progress(session_factory):
    await _add(
        session_factory,
        _make("done", DownloadStatus.DONE),
        _make("err", DownloadStatus.ERROR),
        _make("cancelled", DownloadStatus.CANCELLED),
        _make("running", DownloadStatus.DOWNLOADING),
    )
    async with session_factory() as session:
        deleted = await AsyncORM.clear_finished_downloads(session)
        await session.commit()
    assert deleted == 3
    async with session_factory() as session:
        rows = await AsyncORM.get_all_downloads(session)
    assert [r.id for r in rows] == ["running"]


async def test_reset_stale_downloads(session_factory):
    await _add(
        session_factory,
        _make("p", DownloadStatus.PENDING),
        _make("d", DownloadStatus.DOWNLOADING),
        _make("done", DownloadStatus.DONE),
    )
    async with session_factory() as session:
        reset = await AsyncORM.reset_stale_downloads(session)
        await session.commit()
    assert reset == 2
    async with session_factory() as session:
        rows = {r.id: r for r in await AsyncORM.get_all_downloads(session)}
    assert rows["p"].status == DownloadStatus.ERROR
    assert rows["d"].status == DownloadStatus.ERROR
    assert rows["done"].status == DownloadStatus.DONE


async def test_mark_cancelled_if_pending_only_affects_pending(session_factory):
    await _add(
        session_factory,
        _make("pending", DownloadStatus.PENDING),
        _make("running", DownloadStatus.DOWNLOADING),
    )
    async with session_factory() as session:
        changed_pending = await AsyncORM.mark_cancelled_if_pending(session, "pending")
        changed_running = await AsyncORM.mark_cancelled_if_pending(session, "running")
        await session.commit()

    assert changed_pending == 1
    assert changed_running == 0  # already started — worker owns its status

    async with session_factory() as session:
        rows = {r.id: r for r in await AsyncORM.get_all_downloads(session)}
    assert rows["pending"].status == DownloadStatus.CANCELLED
    assert rows["running"].status == DownloadStatus.DOWNLOADING
