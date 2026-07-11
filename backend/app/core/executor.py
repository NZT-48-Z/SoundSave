import asyncio
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from typing import TypeVar

from app.core.config import settings

_T = TypeVar("_T")

# Один общий пул на всё приложение вместо отдельного пула на каждый роутер.
# Создаётся явно в lifespan, но инициализируется лениво при первом обращении,
# чтобы юнит-тесты, вызывающие run_blocking(), не поднимали lifespan.
_pool: ThreadPoolExecutor | None = None


def init_executor() -> ThreadPoolExecutor:
    """Создаёт общий пул (идемпотентно). Вызывается из lifespan при старте."""
    global _pool
    if _pool is None:
        _pool = ThreadPoolExecutor(
            max_workers=settings.THREAD_POOL_WORKERS,
            thread_name_prefix="soundsave",
        )
    return _pool


def get_executor() -> ThreadPoolExecutor:
    """Возвращает общий пул, создавая его при первом обращении."""
    return _pool if _pool is not None else init_executor()


def shutdown_executor() -> None:
    """Останавливает общий пул при завершении. Текущие задачи не дожидаются."""
    global _pool
    if _pool is not None:
        _pool.shutdown(wait=False, cancel_futures=True)
        _pool = None


async def run_blocking(fn: Callable[..., _T], *args) -> _T:
    """Выполняет блокирующий вызов в общем пуле, не блокируя event loop."""
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(get_executor(), fn, *args)
