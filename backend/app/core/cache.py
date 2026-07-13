import threading
from collections.abc import Callable, Hashable
from typing import TypeVar

from cachetools import TTLCache

_T = TypeVar("_T")


class LockedTTLCache:
    """Потокобезопасная обёртка над ``cachetools.TTLCache``.

    ``TTLCache`` сам по себе не потокобезопасен при конкурентной записи, а
    вызывается из нескольких потоков общего пула — доступ защищён блокировкой.
    Блокировка держится только вокруг чтения/записи словаря, не вокруг
    ``compute``, чтобы медленный сетевой вызов не сериализовал остальные потоки.
    """

    def __init__(self, maxsize: int, ttl: float) -> None:
        """Создаёт кэш ёмкостью ``maxsize`` с временем жизни записи ``ttl`` секунд."""
        self._cache: TTLCache = TTLCache(maxsize=maxsize, ttl=ttl)
        self._lock = threading.Lock()

    def get_or_set(self, key: Hashable, compute: Callable[[], _T]) -> _T:
        """Возвращает значение из кэша либо вычисляет его через ``compute``."""
        with self._lock:
            if key in self._cache:
                return self._cache[key]
        value = compute()
        with self._lock:
            self._cache[key] = value
        return value
