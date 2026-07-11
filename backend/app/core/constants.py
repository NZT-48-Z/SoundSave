from enum import StrEnum


class DownloadStatus(StrEnum):
    """Состояния жизненного цикла загрузки.

    Единый источник правды для строк статуса, которые пишутся в таблицу
    ``downloads`` и возвращаются API. Члены ``StrEnum`` сравниваются и
    сериализуются как обычные строки, поэтому напрямую работают в SQLAlchemy
    и Pydantic.
    """

    PENDING = "pending"
    DOWNLOADING = "downloading"
    CONVERTING = "converting"
    CUTTING = "cutting"
    TAGGING = "tagging"
    DONE = "done"
    ERROR = "error"
    CANCELLED = "cancelled"


# Статусы, из которых задача ещё может выйти — для восстановления при старте
# и проверки при отмене.
IN_PROGRESS_STATUSES = frozenset(
    {
        DownloadStatus.PENDING,
        DownloadStatus.DOWNLOADING,
        DownloadStatus.CONVERTING,
        DownloadStatus.CUTTING,
        DownloadStatus.TAGGING,
    }
)

# Статусы, из которых задача уже не выходит — для отбора завершённых записей.
TERMINAL_STATUSES = frozenset(
    {
        DownloadStatus.DONE,
        DownloadStatus.ERROR,
        DownloadStatus.CANCELLED,
    }
)
