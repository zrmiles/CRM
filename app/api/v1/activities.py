from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_async_session
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.activity import ActivityCreate, ActivityRead
from app.schemas.common import PaginatedResponse
from app.services.activity import ActivityService

router = APIRouter(prefix="/activities", tags=["activities"])


@router.post("/", response_model=ActivityRead, status_code=201)
async def create_activity(
    activity_data: ActivityCreate,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """Создание активности. После создания активность не редактируется."""
    service = ActivityService(session)
    return await service.create_activity(activity_data, current_user)


@router.get("/", response_model=PaginatedResponse[ActivityRead])
async def list_activities(
    client_id: Optional[int] = Query(None),
    deal_id: Optional[int] = Query(None),
    activity_type: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """Список активностей с фильтрами. Продажи видят только свои активности."""
    service = ActivityService(session)
    skip = (page - 1) * per_page
    activities, total = await service.list_activities(
        current_user=current_user,
        client_id=client_id,
        deal_id=deal_id,
        activity_type=activity_type,
        skip=skip,
        limit=per_page,
    )
    return PaginatedResponse(
        items=activities,
        total=total,
        page=page,
        per_page=per_page,
    )


@router.get("/{activity_id}", response_model=ActivityRead)
async def get_activity(
    activity_id: int,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """Получение активности по ID."""
    service = ActivityService(session)
    return await service.get_activity(activity_id, current_user)
