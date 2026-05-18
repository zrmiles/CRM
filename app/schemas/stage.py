from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class StageCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    position: int = Field(ge=1)
    is_default: bool = False


class StageUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    position: Optional[int] = Field(default=None, ge=1)
    is_default: Optional[bool] = None


class StageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    position: int
    is_default: bool
    created_at: datetime


class StageReorder(BaseModel):
    """Список ID стадий в новом порядке"""
    stage_ids: list[int]
