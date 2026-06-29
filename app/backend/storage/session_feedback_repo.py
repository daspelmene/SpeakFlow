from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import desc

from models.session_feedback import SessionFeedback


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

        return feedback

    async def get_feedback_by_user(
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
