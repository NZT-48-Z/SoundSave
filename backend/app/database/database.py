from collections.abc import AsyncGenerator

from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

engine = create_async_engine(
    f"sqlite+aiosqlite:///{settings.db_path_abs}",
    echo=False,
)


@event.listens_for(engine.sync_engine, "connect")
def _set_sqlite_pragma(dbapi_connection, connection_record) -> None:
    """Включает WAL и busy_timeout на каждом новом соединении SQLite."""
    # WAL позволяет читателям-поллерам работать параллельно с записями воркера
    # загрузок; busy_timeout заставляет кратко залоченную БД подождать, а не падать.
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA busy_timeout=5000")
    cursor.execute("PRAGMA synchronous=NORMAL")
    cursor.close()


async_session_factory = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def create_tables() -> None:
    """Создаёт таблицы БД по метаданным моделей (если их ещё нет)."""
    async with engine.begin() as conn:
        from app.models import download  # noqa: F401 — регистрирует модель

        await conn.run_sync(Base.metadata.create_all)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI-зависимость: сессия БД с коммитом при успехе и откатом при ошибке."""
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
