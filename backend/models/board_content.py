"""Club news (athletes only), home event photos and email/upload settings."""

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, Field

from models.schemas import IMG_MAX, new_id, now_utc


class ClubNewsIn(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    body: str = Field(min_length=1, max_length=1000)


class ClubNews(ClubNewsIn):
    id: str = Field(default_factory=new_id)
    created_at: datetime = Field(default_factory=now_utc)


class EventPhotoIn(BaseModel):
    image: str = Field(min_length=1, max_length=IMG_MAX)
    caption: str = Field(default="", max_length=140)


class EventPhoto(BaseModel):
    id: str = Field(default_factory=new_id)
    image: str
    caption: str = ""
    created_at: datetime = Field(default_factory=now_utc)


class UploadLimits(BaseModel):
    member_mb: float
    board_mb: float


class EmailStatus(BaseModel):
    provider: Literal["gmail", "emergent"]
    sender: Optional[str] = None


class EmailTestIn(BaseModel):
    to: EmailStr


class EmailTestResult(BaseModel):
    ok: bool
    provider: Literal["gmail", "emergent"]
