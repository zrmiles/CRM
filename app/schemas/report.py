from decimal import Decimal
from typing import Optional

from pydantic import BaseModel


class StageStats(BaseModel):
    stage_name: str
    deal_count: int
    total_amount: Decimal


class FunnelReport(BaseModel):
    total_deals: int
    total_amount: Decimal
    stages: list[StageStats]
    conversion_rate: Optional[float] = None  # % от новой сделки до успешного закрытия


class CrmAnalytics(BaseModel):
    clients_count: int
    active_deals_count: int
    completed_tasks_count: int
