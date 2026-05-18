from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_async_session
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.common import PaginatedResponse
from app.schemas.task import TaskCreate, TaskRead, TaskUpdate
from app.services.task import TaskService

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.post("/", response_model=TaskRead, status_code=201)
async def create_task(
    task_data: TaskCreate,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """Создание задачи."""
    service = TaskService(session)
    return await service.create_task(task_data, current_user)


@router.get("/", response_model=PaginatedResponse[TaskRead])
async def list_tasks(
    deal_id: Optional[int] = Query(None),
    assignee_id: Optional[int] = Query(None),
    is_completed: Optional[bool] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """Список задач с фильтрами. Продажи видят только свои задачи."""
    service = TaskService(session)
    skip = (page - 1) * per_page
    tasks, total = await service.list_tasks(
        current_user=current_user,
        deal_id=deal_id,
        assignee_id=assignee_id,
        is_completed=is_completed,
        skip=skip,
        limit=per_page,
    )
    return PaginatedResponse(
        items=tasks,
        total=total,
        page=page,
        per_page=per_page,
    )


@router.get("/{task_id}", response_model=TaskRead)
async def get_task(
    task_id: int,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """Получение задачи по ID."""
    service = TaskService(session)
    return await service.get_task(task_id, current_user)


@router.patch("/{task_id}", response_model=TaskRead)
async def update_task(
    task_id: int,
    task_data: TaskUpdate,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """Обновление задачи."""
    service = TaskService(session)
    return await service.update_task(task_id, task_data, current_user)


@router.patch("/{task_id}/complete", response_model=TaskRead)
async def complete_task(
    task_id: int,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """Отметка задачи как выполненной."""
    service = TaskService(session)
    return await service.complete_task(task_id, current_user)


@router.delete("/{task_id}", status_code=204)
async def delete_task(
    task_id: int,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """Удаление задачи."""
    service = TaskService(session)
    await service.delete_task(task_id, current_user)
