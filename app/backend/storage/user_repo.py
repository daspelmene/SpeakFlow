from collections.abc import Sequence
from datetime import datetime

from sqlalchemy import select

from backend.models.user import User
from sqlalchemy.ext.asyncio import AsyncSession


class UserRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create_user(self, data: dict) -> User:
        user = User(**data)
        self.session.add(user)
        await self.session.commit()
        return user

    async def get_user_by_email(self, email: str) -> User | None:
        query = select(User).where(User.email == email)
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def get_user_by_id(self, user_id: int) -> User | None:
        query = select(User).where(User.id == user_id)
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def update_user(self, user_id: int, data: dict) -> User | None:
        query = select(User).where(User.id == user_id)
        result = await self.session.execute(query)
        user = result.scalar_one_or_none()
        if user is None:
            return None
        for key, value in data.items():
            setattr(user, key, value)
        user.updated_at = datetime.now()
        await self.session.commit()
        return user

    async def delete_user(self, user_id: int) -> bool:
        query = select(User).where(User.id == user_id)
        result = await self.session.execute(query)
        user = result.scalar_one_or_none()
        if user is None:
            return False
        await self.session.delete(user)
        await self.session.commit()
        return True

    async def get_matched_users(self, user: User) -> Sequence[User]:
        query = select(User).where(
            User.native_language == user.target_language,
            User.target_language == user.native_language,
            User.id != user.id,
            User.is_active == True,
        )
        result = await self.session.execute(query)
        return result.scalars().all()
