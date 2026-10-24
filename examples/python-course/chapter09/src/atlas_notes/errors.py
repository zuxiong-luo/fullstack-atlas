"""Expected domain and input failures; programming errors stay visible."""


class NoteError(ValueError):
    """A value or notebook operation violates the note contract."""


class ImportFailure(ValueError):
    def __init__(self, line_number: int, detail: str) -> None:
        self.line_number = line_number
        super().__init__(f"line {line_number}: {detail}")


class Conflict(Exception):
    pass


class Busy(Exception):
    pass


