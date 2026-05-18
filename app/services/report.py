from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import UserRole
from app.models.client import Client
from app.models.deal import Deal
from app.models.stage import Stage
from app.models.task import Task
from app.models.user import User
from app.schemas.report import CrmAnalytics, FunnelReport, StageStats
from app.services.stage import CLOSED_WON_STAGE, NEW_STAGE


class ReportService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_funnel_report(
        self,
        current_user: User,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        owner_id: Optional[int] = None,
    ) -> FunnelReport:
        """
        Генерация отчёта по воронке продаж.
        Manager и Sales видят только свои данные.
        """
        if current_user.role in [UserRole.MANAGER.value, UserRole.SALES.value]:
            owner_id = current_user.id

        # Базовый запрос с фильтрами
        query = (
            select(
                Stage.name,
                func.count(Deal.id).label("deal_count"),
                func.coalesce(func.sum(Deal.amount), 0).label("total_amount"),
            )
            .select_from(Stage)
            .outerjoin(Deal, Deal.stage_id == Stage.id)
            .group_by(Stage.id, Stage.name, Stage.position)
            .order_by(Stage.position)
        )

        # Применяем фильтры
        filters = []
        filters.append(Deal.deleted_at.is_(None))
        filters.append(Deal.is_archived.is_(False))
        if owner_id is not None:
            filters.append(Deal.owner_id == owner_id)
        if date_from is not None:
            filters.append(Deal.created_at >= date_from)
        if date_to is not None:
            filters.append(Deal.created_at <= date_to)

        # Если есть фильтры, применяем их через having или where
        if filters:
            for f in filters:
                query = query.where(f)

        result = await self.session.execute(query)
        rows = result.all()

        # Формируем статистику по стадиям
        stages_stats = []
        total_deals = 0
        total_amount = Decimal("0")

        new_stage_count = 0
        closed_won_count = 0

        for row in rows:
            stage_name, deal_count, stage_amount = row
            
            # Пропускаем стадии без сделок если есть фильтры
            if filters and deal_count == 0:
                continue

            stages_stats.append(
                StageStats(
                    stage_name=stage_name,
                    deal_count=deal_count,
                    total_amount=Decimal(str(stage_amount)),
                )
            )
            total_deals += deal_count
            total_amount += Decimal(str(stage_amount))

            if stage_name == NEW_STAGE:
                new_stage_count = deal_count
            elif stage_name == CLOSED_WON_STAGE:
                closed_won_count = deal_count

        # Расчёт конверсии от новой сделки до успешного закрытия
        conversion_rate = None
        if new_stage_count > 0:
            conversion_rate = round((closed_won_count / new_stage_count) * 100, 2)

        return FunnelReport(
            total_deals=total_deals,
            total_amount=total_amount,
            stages=stages_stats,
            conversion_rate=conversion_rate,
        )

    async def get_analytics(self, current_user: User) -> CrmAnalytics:
        owner_id = None
        if current_user.role in [UserRole.MANAGER.value, UserRole.SALES.value]:
            owner_id = current_user.id

        client_query = select(func.count()).select_from(Client).where(
            Client.deleted_at.is_(None),
            Client.is_archived.is_(False),
        )
        active_deals_query = select(func.count()).select_from(Deal).where(
            Deal.deleted_at.is_(None),
            Deal.is_archived.is_(False),
            Deal.closed_at.is_(None),
        )
        completed_tasks_query = (
            select(func.count())
            .select_from(Task)
            .join(Deal, Deal.id == Task.deal_id)
            .where(
                Task.is_completed.is_(True),
                Deal.deleted_at.is_(None),
                Deal.is_archived.is_(False),
            )
        )

        if owner_id is not None:
            client_query = client_query.where(Client.owner_id == owner_id)
            active_deals_query = active_deals_query.where(Deal.owner_id == owner_id)
            completed_tasks_query = completed_tasks_query.where(Deal.owner_id == owner_id)

        clients_count = (await self.session.execute(client_query)).scalar() or 0
        active_deals_count = (await self.session.execute(active_deals_query)).scalar() or 0
        completed_tasks_count = (await self.session.execute(completed_tasks_query)).scalar() or 0

        return CrmAnalytics(
            clients_count=clients_count,
            active_deals_count=active_deals_count,
            completed_tasks_count=completed_tasks_count,
        )
