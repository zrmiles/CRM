import csv
from decimal import Decimal
from io import StringIO
from typing import Optional

from fastapi import APIRouter, Depends, File, Query, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_async_session
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.common import ImportResult, PaginatedResponse
from app.schemas.deal import DealCreate, DealRead, DealUpdate
from app.services.deal import DealService

router = APIRouter(prefix="/deals", tags=["deals"])


@router.post("/", response_model=DealRead, status_code=201)
async def create_deal(
    deal_data: DealCreate,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """Создание сделки."""
    service = DealService(session)
    return await service.create_deal(deal_data, current_user)


@router.get("/", response_model=PaginatedResponse[DealRead])
async def list_deals(
    stage_id: Optional[int] = Query(None),
    client_id: Optional[int] = Query(None),
    owner_id: Optional[int] = Query(None),
    amount_min: Optional[Decimal] = Query(None),
    amount_max: Optional[Decimal] = Query(None),
    include_archived: bool = Query(False),
    include_deleted: bool = Query(False),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """Список сделок с фильтрами. Продажи видят только свои сделки."""
    service = DealService(session)
    skip = (page - 1) * per_page
    deals, total = await service.list_deals(
        current_user=current_user,
        stage_id=stage_id,
        client_id=client_id,
        owner_id=owner_id,
        amount_min=amount_min,
        amount_max=amount_max,
        include_archived=include_archived,
        include_deleted=include_deleted,
        skip=skip,
        limit=per_page,
    )
    return PaginatedResponse(
        items=deals,
        total=total,
        page=page,
        per_page=per_page,
    )


@router.get("/export/csv")
async def export_deals_csv(
    stage_id: Optional[int] = Query(None),
    client_id: Optional[int] = Query(None),
    owner_id: Optional[int] = Query(None),
    include_archived: bool = Query(False),
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """Экспорт сделок в CSV с учетом ролевого доступа."""
    service = DealService(session)
    deals, _ = await service.list_deals(
        current_user=current_user,
        stage_id=stage_id,
        client_id=client_id,
        owner_id=owner_id,
        include_archived=include_archived,
        skip=0,
        limit=10_000,
    )
    output = StringIO()
    writer = csv.DictWriter(
        output,
        fieldnames=[
            "id",
            "title",
            "description",
            "client_id",
            "stage_id",
            "owner_id",
            "amount",
            "closed_at",
            "is_archived",
        ],
    )
    writer.writeheader()
    for deal in deals:
        writer.writerow(
            {
                "id": deal.id,
                "title": deal.title,
                "description": deal.description or "",
                "client_id": deal.client_id,
                "stage_id": deal.stage_id,
                "owner_id": deal.owner_id,
                "amount": deal.amount or 0,
                "closed_at": deal.closed_at.isoformat() if deal.closed_at else "",
                "is_archived": deal.is_archived,
            }
        )
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=deals.csv"},
    )


@router.post("/import/csv", response_model=ImportResult, status_code=201)
async def import_deals_csv(
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """Импорт сделок из CSV. Поддерживаются title,description,client_id,stage_id,amount."""
    service = DealService(session)
    content = (await file.read()).decode("utf-8-sig")
    reader = csv.DictReader(StringIO(content))
    result = ImportResult()
    for row_number, row in enumerate(reader, start=2):
        try:
            await service.create_deal(
                DealCreate(
                    title=(row.get("title") or "").strip(),
                    description=(row.get("description") or None),
                    client_id=int(row.get("client_id") or 0),
                    stage_id=int(row.get("stage_id") or 0),
                    amount=Decimal(row.get("amount") or "0"),
                ),
                current_user,
            )
            result.created += 1
        except Exception as exc:
            result.skipped += 1
            result.errors.append(f"row {row_number}: {getattr(exc, 'detail', str(exc))}")
    return result


@router.get("/{deal_id:int}", response_model=DealRead)
async def get_deal(
    deal_id: int,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """Получение сделки по ID."""
    service = DealService(session)
    return await service.get_deal(deal_id, current_user)


@router.patch("/{deal_id:int}", response_model=DealRead)
async def update_deal(
    deal_id: int,
    deal_data: DealUpdate,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """Обновление сделки. Владельца могут менять только менеджер и администратор."""
    service = DealService(session)
    return await service.update_deal(deal_id, deal_data, current_user)


@router.patch("/{deal_id:int}/archive", response_model=DealRead)
async def archive_deal(
    deal_id: int,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """Архивация сделки без удаления данных."""
    service = DealService(session)
    return await service.set_archive_state(deal_id, current_user, True)


@router.patch("/{deal_id:int}/unarchive", response_model=DealRead)
async def unarchive_deal(
    deal_id: int,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """Снятие сделки с архива."""
    service = DealService(session)
    return await service.set_archive_state(deal_id, current_user, False)


@router.delete("/{deal_id:int}", status_code=204)
async def delete_deal(
    deal_id: int,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """Удаление сделки."""
    service = DealService(session)
    await service.delete_deal(deal_id, current_user)
