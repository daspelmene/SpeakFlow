from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from models.session_feedback import SessionFeedback

from uuid import UUID

class SessionFeedbackRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create_feedback(
        self,
        data: dict,
    ) -> SessionFeedback:
        feedback = SessionFeedback(**data)

        self.session.add(feedback)

        await self.session.commit()
        await self.session.refresh(feedback)

        return feedback

    async def get_feedback_by_user(
        self,
        target_user_id: int,
    ) -> list[SessionFeedback]:
        return await self.get_feedback_by_target_user(target_user_id)

    async def get_feedback_by_target_user(
        self,
        target_user_id: int,
    ) -> list[SessionFeedback]:
        query = (
            select(SessionFeedback)
            .where(SessionFeedback.target_user_id == target_user_id)
            .order_by(desc(SessionFeedback.created_at))
        )

        result = await self.session.execute(query)

        return list(result.scalars().all())

    async def get_feedback_by_author(
        self,
        author_id: int,
    ) -> list[SessionFeedback]:
        query = (
            select(SessionFeedback)
            .where(SessionFeedback.author_id == author_id)
            .order_by(desc(SessionFeedback.created_at))
        )

        result = await self.session.execute(query)

        return list(result.scalars().all())
    
    async def get_feedback_by_author_and_room(
        self,
        room_id: UUID,
        author_id: int,
    ):
        query = (
            select(SessionFeedback)
            .where(
                SessionFeedback.room_id == room_id,
                SessionFeedback.author_id == author_id,
            )
            .order_by(SessionFeedback.created_at)
        )

        result = await self.session.execute(query)
        return list(result.scalars().all())
