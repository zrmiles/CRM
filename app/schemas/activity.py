from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.core.constants import ActivityType


class ActivityCreate(BaseModel):
    type: ActivityType
    description: str = Field(min_length=1)
    client_id: int
    deal_id: Optional[int] = None


class ActivityRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    type: str
    description: str
    client_id: int
    deal_id: Optional[int] = None
    user_id: int
    created_at: datetime
