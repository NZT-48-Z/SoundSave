import asyncio
from collections.abc import Awaitable, Callable, Iterable
from typing import TypeVar

_T = TypeVar("_T")
_R = TypeVar("_R")


async def bounded_gather(
    items: Iterable[_T],
    worker: Callable[[_T], Awaitable[_R]],
    *,
    limit: int,
) -> list[_R]:
    """Применяет ``worker`` к ``items`` не более чем в ``limit`` задач одновременно.

    Сохраняет исходный порядок в результирующем списке (как ``asyncio.gather``).
    """
    sem = asyncio.Semaphore(limit)

    async def run(item: _T) -> _R:
        """Запускает worker для одного элемента под семафором."""
        async with sem:
            return await worker(item)

    return await asyncio.gather(*[run(item) for item in items])
