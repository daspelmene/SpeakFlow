import asyncio

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.backend.config.config import settings
from app.backend.main import app
from app.backend.storage.database import Database
from app.backend.storage.user_repo import UserRepository
from app.tests.constants.user import REGISTER_DATA


@pytest.fixture(scope="session")
def db_available():
    async def _check():
        try:
            engine = create_async_engine(settings.DATABASE_URL)
            async with engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
            await engine.dispose()
            return True
        except Exception:
            return False

    return asyncio.run(_check())


@pytest_asyncio.fixture(autouse=True)
async def _reset_engine():
    Database.engine = None
    Database.async_session_factory = None
    yield


@pytest_asyncio.fixture
async def cleanup_user():
    engine = create_async_engine(settings.DATABASE_URL)
    factory = async_sessionmaker(
        engine, expire_on_commit=False, class_=AsyncSession
    )
    async with factory() as session:
        repo = UserRepository(session)
        user = await repo.get_user_by_email(REGISTER_DATA["email"])
        if user:
            await session.delete(user)
            await session.commit()
    await engine.dispose()
    yield


@pytest_asyncio.fixture
async def async_client(db_available, cleanup_user):
    if not db_available:
        pytest.skip("Database is not available")
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
