import os
from pathlib import Path
from typing import AsyncGenerator

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

os.environ.setdefault("SECRET_KEY", "test-secret-key-for-mini-crm-tests-32-chars")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./test.db")

from app.core.database import get_async_session
from app.main import app
from app.models.base import Base


@pytest_asyncio.fixture(scope="function")
async def db_session(tmp_path: Path) -> AsyncGenerator[AsyncSession, None]:
    test_db_path = tmp_path / "test.db"
    test_database_url = f"sqlite+aiosqlite:///{test_db_path}"

    test_engine = create_async_engine(test_database_url, echo=False)
    test_session_maker = async_sessionmaker(
        test_engine, class_=AsyncSession, expire_on_commit=False
    )

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with test_session_maker() as session:
        yield session

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    await test_engine.dispose()


@pytest_asyncio.fixture(scope="function")
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        yield db_session

    app.dependency_overrides[get_async_session] = override_get_db

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def admin_token(client: AsyncClient) -> str:
    response = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "admin@test.com",
            "password": "admin123",
            "full_name": "Admin User",
            "role": "admin",
        },
    )
    assert response.status_code == 201

    response = await client.post(
        "/api/v1/auth/login",
        json={"email": "admin@test.com", "password": "admin123"},
    )
    assert response.status_code == 200
    return response.json()["access_token"]


@pytest_asyncio.fixture
async def manager_token(client: AsyncClient, admin_token: str) -> str:
    response = await client.post(
        "/api/v1/auth/register",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "email": "manager@test.com",
            "password": "manager123",
            "full_name": "Manager User",
            "role": "manager",
        },
    )
    assert response.status_code == 201

    response = await client.post(
        "/api/v1/auth/login",
        json={"email": "manager@test.com", "password": "manager123"},
    )
    assert response.status_code == 200
    return response.json()["access_token"]


@pytest_asyncio.fixture
async def sales_token(client: AsyncClient, admin_token: str) -> str:
    response = await client.post(
        "/api/v1/auth/register",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "email": "sales@test.com",
            "password": "sales123",
            "full_name": "Sales User",
            "role": "sales",
        },
    )
    assert response.status_code == 201

    response = await client.post(
        "/api/v1/auth/login",
        json={"email": "sales@test.com", "password": "sales123"},
    )
    assert response.status_code == 200
    return response.json()["access_token"]
