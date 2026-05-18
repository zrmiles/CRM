from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_async_session
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.report import CrmAnalytics, FunnelReport
from app.services.report import ReportService

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/funnel", response_model=FunnelReport)
async def get_funnel_report(
    date_from: Optional[datetime] = Query(None, description="Фильтр сделок с этой даты"),
    date_to: Optional[datetime] = Query(None, description="Фильтр сделок до этой даты"),
    owner_id: Optional[int] = Query(None, description="Фильтр по владельцу (только менеджер и администратор)"),
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """
    Отчет по воронке продаж: количество и сумма сделок по стадиям.
    Пользователи с ролью продаж видят только свои данные.
    """
    service = ReportService(session)
    return await service.get_funnel_report(
        current_user=current_user,
        date_from=date_from,
        date_to=date_to,
        owner_id=owner_id,
    )


@router.get("/analytics", response_model=CrmAnalytics)
async def get_analytics(
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """Базовая CRM-аналитика: клиенты, активные сделки, завершенные задачи."""
    service = ReportService(session)
    return await service.get_analytics(current_user)
