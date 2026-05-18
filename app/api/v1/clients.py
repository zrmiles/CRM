import csv
from io import StringIO
from typing import Optional

from fastapi import APIRouter, Depends, File, Query, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_async_session
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.client import ClientCreate, ClientRead, ClientUpdate
from app.schemas.common import ImportResult, PaginatedResponse
from app.services.client import ClientService

router = APIRouter(prefix="/clients", tags=["clients"])


@router.post("/", response_model=ClientRead, status_code=201)
async def create_client(
    client_data: ClientCreate,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """Создание клиента."""
    service = ClientService(session)
    return await service.create_client(client_data, current_user)


@router.get("/", response_model=PaginatedResponse[ClientRead])
async def list_clients(
    search: Optional[str] = Query(None, description="Поиск по имени, почте, телефону или компании"),
    owner_id: Optional[int] = Query(None, description="Фильтр по владельцу. Продажи видят только своих клиентов."),
    include_archived: bool = Query(False),
    include_deleted: bool = Query(False),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """Список клиентов с пагинацией и поиском. Продажи видят только своих клиентов."""
    service = ClientService(session)
    skip = (page - 1) * per_page
    clients, total = await service.list_clients(
        current_user=current_user,
        search=search,
        owner_id=owner_id,
        include_archived=include_archived,
        include_deleted=include_deleted,
        skip=skip,
        limit=per_page,
    )
    return PaginatedResponse(
        items=clients,
        total=total,
        page=page,
        per_page=per_page,
    )


@router.get("/{client_id:int}", response_model=ClientRead)
async def get_client(
    client_id: int,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """Получение клиента по ID."""
    service = ClientService(session)
    return await service.get_client(client_id, current_user)


@router.get("/export/csv")
async def export_clients_csv(
    search: Optional[str] = Query(None),
    owner_id: Optional[int] = Query(None),
    include_archived: bool = Query(False),
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """Экспорт клиентов в CSV с учетом ролевого доступа."""
    service = ClientService(session)
    clients, _ = await service.list_clients(
        current_user=current_user,
        search=search,
        owner_id=owner_id,
        include_archived=include_archived,
        skip=0,
        limit=10_000,
    )
    output = StringIO()
    writer = csv.DictWriter(
        output,
        fieldnames=["id", "first_name", "last_name", "email", "phone", "company", "owner_id", "is_archived"],
    )
    writer.writeheader()
    for client in clients:
        writer.writerow(
            {
                "id": client.id,
                "first_name": client.first_name,
                "last_name": client.last_name,
                "email": client.email or "",
                "phone": client.phone or "",
                "company": client.company or "",
                "owner_id": client.owner_id,
                "is_archived": client.is_archived,
            }
        )
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=clients.csv"},
    )


@router.post("/import/csv", response_model=ImportResult, status_code=201)
async def import_clients_csv(
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """Импорт клиентов из CSV. Поддерживаются first_name,last_name,email,phone,company."""
    service = ClientService(session)
    content = (await file.read()).decode("utf-8-sig")
    reader = csv.DictReader(StringIO(content))
    result = ImportResult()
    for row_number, row in enumerate(reader, start=2):
        try:
            await service.create_client(
                ClientCreate(
                    first_name=(row.get("first_name") or "").strip(),
                    last_name=(row.get("last_name") or "").strip(),
                    email=(row.get("email") or None),
                    phone=(row.get("phone") or None),
                    company=(row.get("company") or None),
                ),
                current_user,
            )
            result.created += 1
        except Exception as exc:
            result.skipped += 1
            result.errors.append(f"row {row_number}: {getattr(exc, 'detail', str(exc))}")
    return result


@router.patch("/{client_id:int}", response_model=ClientRead)
async def update_client(
    client_id: int,
    client_data: ClientUpdate,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """Обновление клиента."""
    service = ClientService(session)
    return await service.update_client(client_id, client_data, current_user)


@router.patch("/{client_id:int}/archive", response_model=ClientRead)
async def archive_client(
    client_id: int,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """Архивация клиента без удаления данных."""
    service = ClientService(session)
    return await service.set_archive_state(client_id, current_user, True)


@router.patch("/{client_id:int}/unarchive", response_model=ClientRead)
async def unarchive_client(
    client_id: int,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """Снятие клиента с архива."""
    service = ClientService(session)
    return await service.set_archive_state(client_id, current_user, False)


@router.delete("/{client_id:int}", status_code=204)
async def delete_client(
    client_id: int,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
):
    """Удаление клиента."""
    service = ClientService(session)
    await service.delete_client(client_id, current_user)
