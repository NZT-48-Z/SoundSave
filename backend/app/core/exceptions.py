class AppError(Exception):
    """Базовое доменное исключение с пользовательским сообщением."""

    def __init__(self, message: str):
        """Сохраняет текст сообщения в ``self.message``."""
        self.message = message
        super().__init__(message)


class SoundCloudError(AppError):
    pass


class DownloadError(AppError):
    pass


class YandexError(AppError):
    pass


class YandexNotConnectedError(YandexError):
    """Операции с Yandex Music нужен токен, но он не сохранён."""

    def __init__(self, message: str = "YANDEX_NOT_CONNECTED"):
        """Задаёт сообщение по умолчанию — маркер ``YANDEX_NOT_CONNECTED``."""
        super().__init__(message)
