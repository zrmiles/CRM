from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import UserRole
from app.core.database import get_async_session
from app.core.dependencies import require_roles
from app.models.audit_log import AuditLog
from app.models.user import User
from app.schemas.audit_log import AuditLogRead
from app.schemas.common import PaginatedResponse

router = APIRouter(prefix="/audit-logs", tags=["audit-logs"])


@router.get("/", response_model=PaginatedResponse[AuditLogRead])
async def list_audit_logs(
    entity_type: Optional[str] = Query(None),
    entity_id: Optional[int] = Query(None),
    actor_id: Optional[int] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    session: AsyncSession = Depends(get_async_session),
    _: User = Depends(require_roles(UserRole.ADMIN)),
):
    query = select(AuditLog)
    count_query = select(func.count()).select_from(AuditLog)
    filters = []
    if entity_type is not None:
        filters.append(AuditLog.entity_type == entity_type)
    if entity_id is not None:
        filters.append(AuditLog.entity_id == entity_id)
    if actor_id is not None:
        filters.append(AuditLog.actor_id == actor_id)

    for item in filters:
        query = query.where(item)
        count_query = count_query.where(item)

    skip = (page - 1) * per_page
    query = query.order_by(AuditLog.created_at.desc(), AuditLog.id.desc()).offset(skip).limit(per_page)
    logs = (await session.execute(query)).scalars().all()
    total = (await session.execute(count_query)).scalar() or 0
    return PaginatedResponse(items=logs, total=total, page=page, per_page=per_page)
