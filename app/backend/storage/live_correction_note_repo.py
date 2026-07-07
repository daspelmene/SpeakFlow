from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from models.live_correction_note import LiveCorrectionNote

from uuid import UUID

class LiveCorrectionNoteRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create_note(self, data: dict) -> LiveCorrectionNote:
        note = LiveCorrectionNote(**data)

        self.session.add(note)

        await self.session.commit()
        await self.session.refresh(note)

        return note

    async def get_notes_by_user(self, target_user_id: int) -> list[LiveCorrectionNote]:
        return await self.get_notes_by_target_user(target_user_id)

    async def get_notes_by_target_user(
        self,
        target_user_id: int,
    ) -> list[LiveCorrectionNote]:
        query = (
            select(LiveCorrectionNote)
            .where(LiveCorrectionNote.target_user_id == target_user_id)
            .order_by(desc(LiveCorrectionNote.created_at))
        )

        result = await self.session.execute(query)

        return list(result.scalars().all())

    async def get_notes_by_author(
        self,
        author_id: int,
    ) -> list[LiveCorrectionNote]:
        query = (
            select(LiveCorrectionNote)
            .where(LiveCorrectionNote.author_id == author_id)
            .order_by(desc(LiveCorrectionNote.created_at))
        )

        result = await self.session.execute(query)

        return list(result.scalars().all())
    
    async def get_notes_by_author_and_room(self, room_id: UUID, author_id: int):
        query = (
            select(LiveCorrectionNote)
            .where(
                LiveCorrectionNote.room_id == room_id,
                LiveCorrectionNote.author_id == author_id,
            )
            .order_by(LiveCorrectionNote.created_at)
        )

        result = await self.session.execute(query)
        return list(result.scalars().all())
