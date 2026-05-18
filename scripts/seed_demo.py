"""Заполнение локальной Mini-CRM демонстрационными данными.

Run from the project root:
    DEBUG=false python -m scripts.seed_demo
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import select

from app.core.database import async_session_maker
from app.core.security import hash_password
from app.models.activity import Activity
from app.models.client import Client
from app.models.deal import Deal
from app.models.stage import Stage
from app.models.task import Task
from app.models.user import User
from app.services.stage import (
    CLOSED_LOST_STAGE,
    CLOSED_WON_STAGE,
    NEW_STAGE,
)


DEMO_PASSWORD = "demo12345"


async def get_or_create_user(session, email: str, full_name: str, role: str) -> User:
    user = await session.scalar(select(User).where(User.email == email))
    if user:
        user.full_name = full_name
        user.role = role
        user.hashed_password = hash_password(DEMO_PASSWORD)
        if not user.is_active:
            user.is_active = True
        return user

    user = User(
        email=email,
        full_name=full_name,
        role=role,
        hashed_password=hash_password(DEMO_PASSWORD),
        is_active=True,
    )
    session.add(user)
    await session.flush()
    return user


async def get_or_create_stage(
    session,
    name: str,
    position: int,
    is_default: bool = True,
    old_name: str | None = None,
) -> Stage:
    stage = await session.scalar(select(Stage).where(Stage.name == name))
    if stage:
        return stage

    if old_name:
        stage = await session.scalar(select(Stage).where(Stage.name == old_name))
        if stage:
            stage.name = name
            stage.position = position
            stage.is_default = is_default
            await session.flush()
            return stage

    stage = Stage(name=name, position=position, is_default=is_default)
    session.add(stage)
    await session.flush()
    return stage


async def get_or_create_client(
    session,
    *,
    email: str,
    first_name: str,
    last_name: str,
    phone: str,
    company: str,
    owner_id: int,
) -> Client:
    client = await session.scalar(select(Client).where(Client.email == email))
    if client:
        return client

    client = Client(
        email=email,
        first_name=first_name,
        last_name=last_name,
        phone=phone,
        company=company,
        owner_id=owner_id,
    )
    session.add(client)
    await session.flush()
    return client


async def get_or_create_deal(
    session,
    *,
    title: str,
    client_id: int,
    stage_id: int,
    owner_id: int,
    amount: Decimal,
    description: str,
    closed_at: datetime | None = None,
) -> Deal:
    deal = await session.scalar(
        select(Deal).where(Deal.title == title, Deal.client_id == client_id)
    )
    if deal:
        return deal

    deal = Deal(
        title=title,
        client_id=client_id,
        stage_id=stage_id,
        owner_id=owner_id,
        amount=amount,
        description=description,
        closed_at=closed_at,
    )
    session.add(deal)
    await session.flush()
    return deal


async def get_or_create_task(
    session,
    *,
    title: str,
    deal_id: int,
    assignee_id: int,
    description: str,
    due_date: datetime,
    is_completed: bool = False,
) -> Task:
    task = await session.scalar(select(Task).where(Task.title == title, Task.deal_id == deal_id))
    if task:
        return task

    task = Task(
        title=title,
        deal_id=deal_id,
        assignee_id=assignee_id,
        description=description,
        due_date=due_date,
        is_completed=is_completed,
    )
    session.add(task)
    await session.flush()
    return task


async def create_activity_once(
    session,
    *,
    activity_type: str,
    description: str,
    client_id: int,
    user_id: int,
    deal_id: int | None = None,
) -> None:
    activity = await session.scalar(
        select(Activity).where(
            Activity.description == description,
            Activity.client_id == client_id,
            Activity.deal_id == deal_id,
        )
    )
    if activity:
        return

    session.add(
        Activity(
            type=activity_type,
            description=description,
            client_id=client_id,
            deal_id=deal_id,
            user_id=user_id,
        )
    )


async def seed_demo() -> None:
    now = datetime.now(timezone.utc)
    async with async_session_maker() as session:
        admin = await get_or_create_user(session, "admin@test.com", "Администратор", "admin")
        manager = await get_or_create_user(session, "manager@test.com", "Менеджер", "manager")
        sales = await get_or_create_user(session, "sales@test.com", "Продавец", "sales")

        lead = await get_or_create_stage(session, NEW_STAGE, 1, old_name="New")
        contact = await get_or_create_stage(
            session,
            "Квалификация",
            2,
            is_default=False,
            old_name="Qualification",
        )
        proposal = await get_or_create_stage(
            session,
            "Предложение",
            3,
            is_default=False,
            old_name="Proposal",
        )
        await get_or_create_stage(
            session,
            "Переговоры",
            4,
            is_default=False,
            old_name="Negotiation",
        )
        won = await get_or_create_stage(
            session,
            CLOSED_WON_STAGE,
            5,
            is_default=False,
            old_name="Closed Won",
        )
        lost = await get_or_create_stage(
            session,
            CLOSED_LOST_STAGE,
            6,
            is_default=False,
            old_name="Closed Lost",
        )

        client_1 = await get_or_create_client(
            session,
            email="ivan.petrov@example.com",
            first_name="Иван",
            last_name="Петров",
            phone="+7 999 100-20-30",
            company="Retail Pro",
            owner_id=sales.id,
        )
        client_2 = await get_or_create_client(
            session,
            email="anna.smirnova@example.com",
            first_name="Анна",
            last_name="Смирнова",
            phone="+7 999 200-30-40",
            company="Market Line",
            owner_id=manager.id,
        )
        client_3 = await get_or_create_client(
            session,
            email="oleg.ivanov@example.com",
            first_name="Олег",
            last_name="Иванов",
            phone="+7 999 300-40-50",
            company="Store House",
            owner_id=sales.id,
        )

        deal_1 = await get_or_create_deal(
            session,
            title="Поставка кассового оборудования",
            client_id=client_1.id,
            stage_id=proposal.id,
            owner_id=sales.id,
            amount=Decimal("185000.00"),
            description="Комплект касс и сканеров для двух торговых точек.",
        )
        deal_2 = await get_or_create_deal(
            session,
            title="Расширение склада",
            client_id=client_2.id,
            stage_id=contact.id,
            owner_id=manager.id,
            amount=Decimal("320000.00"),
            description="Переговоры по поставке терминалов сбора данных.",
        )
        deal_3 = await get_or_create_deal(
            session,
            title="Сервисный контракт",
            client_id=client_3.id,
            stage_id=won.id,
            owner_id=sales.id,
            amount=Decimal("72000.00"),
            description="Годовой сервисный контракт для магазина.",
            closed_at=now - timedelta(days=3),
        )
        deal_4 = await get_or_create_deal(
            session,
            title="Пилотная интеграция",
            client_id=client_2.id,
            stage_id=lost.id,
            owner_id=manager.id,
            amount=Decimal("95000.00"),
            description="Клиент отложил проект до следующего квартала.",
            closed_at=now - timedelta(days=8),
        )
        deal_5 = await get_or_create_deal(
            session,
            title="Первичная консультация",
            client_id=client_1.id,
            stage_id=lead.id,
            owner_id=sales.id,
            amount=Decimal("45000.00"),
            description="Нужно уточнить требования по рабочим местам.",
        )

        await get_or_create_task(
            session,
            title="Позвонить Ивану по КП",
            deal_id=deal_1.id,
            assignee_id=sales.id,
            description="Уточнить, согласовали ли коммерческое предложение.",
            due_date=now + timedelta(days=1),
        )
        await get_or_create_task(
            session,
            title="Подготовить расчет склада",
            deal_id=deal_2.id,
            assignee_id=manager.id,
            description="Собрать финальную спецификацию и отправить клиенту.",
            due_date=now + timedelta(days=2),
        )
        await get_or_create_task(
            session,
            title="Отправить акт по сервису",
            deal_id=deal_3.id,
            assignee_id=sales.id,
            description="Закрывающий документ по первому месяцу обслуживания.",
            due_date=now - timedelta(days=1),
            is_completed=True,
        )

        await create_activity_once(
            session,
            activity_type="call",
            description="Первичный звонок, клиент подтвердил интерес.",
            client_id=client_1.id,
            deal_id=deal_5.id,
            user_id=sales.id,
        )
        await create_activity_once(
            session,
            activity_type="email",
            description="Отправлено коммерческое предложение.",
            client_id=client_1.id,
            deal_id=deal_1.id,
            user_id=sales.id,
        )
        await create_activity_once(
            session,
            activity_type="meeting",
            description="Встреча с закупками по складскому проекту.",
            client_id=client_2.id,
            deal_id=deal_2.id,
            user_id=manager.id,
        )
        await create_activity_once(
            session,
            activity_type="note",
            description="Клиент попросил вернуться к пилоту позже.",
            client_id=client_2.id,
            deal_id=deal_4.id,
            user_id=manager.id,
        )

        await session.commit()

    print("Демонстрационные данные готовы.")
    print("Логины:")
    print(f"  admin@test.com / {DEMO_PASSWORD}")
    print(f"  manager@test.com / {DEMO_PASSWORD}")
    print(f"  sales@test.com / {DEMO_PASSWORD}")


if __name__ == "__main__":
    asyncio.run(seed_demo())
