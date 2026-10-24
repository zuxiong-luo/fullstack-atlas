from collections.abc import Mapping
from dataclasses import dataclass, field
from pathlib import Path
import re


@dataclass(frozen=True)
class AuthSettings:
    token: str = field(repr=False)

    def __post_init__(self) -> None:
        if not re.fullmatch(r"[A-Za-z0-9_-]{16,128}", self.token):
            raise ValueError("ATLAS_TOKEN must be 16..128 ASCII token characters")


@dataclass(frozen=True)
class Config:
    database: Path
    auth: AuthSettings
    port: int = 8019
    pool_size: int = 2

    @classmethod
    def from_env(cls, values: Mapping[str, str]) -> "Config":
        known = {"ATLAS_DB", "ATLAS_TOKEN", "ATLAS_PORT", "ATLAS_POOL_SIZE"}
        if any(key.startswith("ATLAS_") and key not in known for key in values):
            raise ValueError("unknown ATLAS_ configuration key")
        raw_path = values.get("ATLAS_DB", "")
        if not raw_path or not Path(raw_path).is_absolute():
            raise ValueError("ATLAS_DB must be an absolute local file path")

        def integer(key: str, default: int, lower: int, upper: int) -> int:
            value = values.get(key, str(default))
            if not value.isascii() or not value.isdecimal() or not lower <= int(value) <= upper:
                raise ValueError(f"{key} outside {lower}..{upper}")
            return int(value)

        return cls(Path(raw_path), AuthSettings(values.get("ATLAS_TOKEN", "")),
                   integer("ATLAS_PORT", 8019, 0, 65535),
                   integer("ATLAS_POOL_SIZE", 2, 1, 4))
