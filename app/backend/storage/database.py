from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.ext.asyncio import async_sessionmaker
from sqlalchemy.ext.asyncio.session import AsyncSession

from config.config import settings
from storage.user_repo import UserRepository


class Database:
    engine = None
    async_session_factory = None

    @classmethod
    def _ensure_engine(cls):
        if cls.engine is None:
            cls.engine = create_async_engine(settings.DATABASE_URL, echo=True)
            cls.async_session_factory = async_sessionmaker(cls.engine, expire_on_commit=False)

    def __init__(self, session: AsyncSession):
        self.session = session
        self.users = UserRepository(session)

    @classmethod
    async def get_db(cls):
        cls._ensure_engine()
        async with cls.async_session_factory() as session:
            yield cls(session)
