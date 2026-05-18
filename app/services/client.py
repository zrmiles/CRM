from datetime import datetime, timezone
from typing import Optional, Sequence

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import UserRole
from app.core.exceptions import BadRequestException, ForbiddenException, NotFoundException
from app.models.client import Client
from app.models.user import User
from app.repositories.activity import ActivityRepository
from app.repositories.client import ClientRepository
from app.repositories.deal import DealRepository
from app.schemas.client import ClientCreate, ClientUpdate
from app.services.audit import record_audit_log, snapshot


CLIENT_AUDIT_FIELDS = [
    "id",
    "first_name",
    "last_name",
    "email",
    "phone",
    "company",
    "owner_id",
    "is_archived",
    "archived_at",
    "deleted_at",
]


class ClientService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.client_repo = ClientRepository(session)
        self.deal_repo = DealRepository(session)
        self.activity_repo = ActivityRepository(session)

    def _get_owner_filter(self, current_user: User) -> Optional[int]:
        """Manager и Sales видят только своих клиентов, Admin — всех."""
        if current_user.role in [UserRole.MANAGER.value, UserRole.SALES.value]:
            return current_user.id
        return None

    def _check_ownership(self, client: Client, current_user: User) -> None:
        """Проверка права доступа к клиенту"""
        if current_user.role in [UserRole.MANAGER.value, UserRole.SALES.value]:
            if client.owner_id != current_user.id:
                raise ForbiddenException("Нет доступа к этому клиенту")

    async def create_client(
        self, client_data: ClientCreate, current_user: User
    ) -> Client:
        data = client_data.model_dump()
        data["owner_id"] = current_user.id
        client = await self.client_repo.create(data)
        await record_audit_log(
            self.session,
            actor=current_user,
            action="create",
            entity_type="client",
            entity_id=client.id,
            after=snapshot(client, CLIENT_AUDIT_FIELDS),
        )
        return client

    async def list_clients(
        self,
        current_user: User,
        search: Optional[str] = None,
        owner_id: Optional[int] = None,
        include_archived: bool = False,
        include_deleted: bool = False,
        skip: int = 0,
        limit: int = 100,
    ) -> tuple[Sequence[Client], int]:
        owner_filter = self._get_owner_filter(current_user)
        effective_owner_id = owner_filter if owner_filter is not None else owner_id

        clients = await self.client_repo.search(
            query=search,
            owner_id=effective_owner_id,
            include_archived=include_archived,
            include_deleted=include_deleted,
            skip=skip,
            limit=limit,
        )
        total = await self.client_repo.count_search(
            query=search,
            owner_id=effective_owner_id,
            include_archived=include_archived,
            include_deleted=include_deleted,
        )
        return clients, total

    async def get_client(self, client_id: int, current_user: User) -> Client:
        client = await self.client_repo.get_by_id(client_id)
        if not client:
            raise NotFoundException(f"Клиент с id {client_id} не найден")

        self._check_ownership(client, current_user)
        return client

    async def update_client(
        self, client_id: int, client_data: ClientUpdate, current_user: User
    ) -> Client:
        client = await self.get_client(client_id, current_user)
        update_data = client_data.model_dump(exclude_unset=True)
        before = snapshot(client, CLIENT_AUDIT_FIELDS)
        updated = await self.client_repo.update(client, update_data)
        await record_audit_log(
            self.session,
            actor=current_user,
            action="update",
            entity_type="client",
            entity_id=updated.id,
            before=before,
            after=snapshot(updated, CLIENT_AUDIT_FIELDS),
        )
        return updated

    async def delete_client(self, client_id: int, current_user: User) -> None:
        client = await self.get_client(client_id, current_user)
        before = snapshot(client, CLIENT_AUDIT_FIELDS)
        client.deleted_at = datetime.now(timezone.utc)
        await self.session.commit()
        await self.session.refresh(client)
        await record_audit_log(
            self.session,
            actor=current_user,
            action="soft_delete",
            entity_type="client",
            entity_id=client.id,
            before=before,
            after=snapshot(client, CLIENT_AUDIT_FIELDS),
        )

    async def set_archive_state(
        self, client_id: int, current_user: User, is_archived: bool
    ) -> Client:
        client = await self.get_client(client_id, current_user)
        before = snapshot(client, CLIENT_AUDIT_FIELDS)
        now = datetime.now(timezone.utc)
        client.is_archived = is_archived
        client.archived_at = now if is_archived else None
        await self.session.commit()
        await self.session.refresh(client)
        await record_audit_log(
            self.session,
            actor=current_user,
            action="archive" if is_archived else "unarchive",
            entity_type="client",
            entity_id=client.id,
            before=before,
            after=snapshot(client, CLIENT_AUDIT_FIELDS),
        )
        return client
