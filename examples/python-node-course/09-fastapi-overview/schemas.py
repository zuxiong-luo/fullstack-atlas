from typing import Literal
from pydantic import BaseModel, ConfigDict, Field


class QuoteInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    seconds: int = Field(strict=True, ge=1, le=120)
    quality: Literal["standard", "hd"] = "standard"


class QuoteOutput(BaseModel):
    seconds: int
    quality: Literal["standard", "hd"]
    credits: int
