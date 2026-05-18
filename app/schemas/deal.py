from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class DealCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: Optional[str] = None
    client_id: int
    stage_id: int
    amount: Optional[Decimal] = Field(default=Decimal("0"), ge=Decimal("0"))


class DealUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = None
    client_id: Optional[int] = None
    stage_id: Optional[int] = None
    owner_id: Optional[int] = None  # Только Manager/Admin могут менять
    amount: Optional[Decimal] = Field(default=None, ge=Decimal("0"))


class DealRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: Optional[str] = None
    client_id: int
    stage_id: int
    owner_id: int
    amount: Optional[Decimal] = None
    closed_at: Optional[datetime] = None
    is_archived: bool = False
    archived_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
