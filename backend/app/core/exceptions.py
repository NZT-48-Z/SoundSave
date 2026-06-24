class SoundCloudError(Exception):
    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


class DownloadError(Exception):
    def __init__(self, message: str):
        self.message = message
        super().__init__(message)
