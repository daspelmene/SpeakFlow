from uuid import UUID
from sqlalchemy import select, or_, and_
from models.room import Room
from sqlalchemy.ext.asyncio import AsyncSession
from models.user import User

import logging

logger = logging.getLogger("room-repo")


class RoomRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create_room(
        self, user_creator_id: int, invited_user_id: int
    ) -> Room:
        logger.info(
            f"Creating room: creator={user_creator_id}, invited={invited_user_id}"
        )
        room = Room(
            user_creator_id=user_creator_id,
            invited_user_id=invited_user_id,
        )
        self.session.add(room)
        await self.session.commit()
        await self.session.refresh(room)
        logger.info(f"Room created: {room.room_id}")
        return room

    async def get_room_by_id(self, room_id: UUID) -> Room | None:
        logger.debug(f"Fetching room by id: {room_id}")
        query = select(Room).where(Room.room_id == room_id)
        result = await self.session.execute(query)
        room = result.scalar_one_or_none()
        if room:
            logger.debug(f"Room found: {room.room_id}")
        else:
            logger.debug(f"Room not found: {room_id}")
        return room

    async def get_pending_invitations(self, user_id: int) -> list[Room]:
        """Get rooms where user is invited and hasn't accepted yet."""
        logger.debug(f"Fetching pending invitations for user: {user_id}")
        query = select(Room).where(
            and_(
                Room.invited_user_id == user_id,
                Room.is_invited_accepted == False,
            )
        )
        result = await self.session.execute(query)
        rooms = list(result.scalars().all())
        logger.debug(f"Found {len(rooms)} pending invitations for user {user_id}")
        return rooms

    async def get_active_room_for_user(self, user_id: int) -> Room | None:
        """Get any active room where user is either creator or invited (and accepted)."""
        logger.debug(f"Checking active rooms for user: {user_id}")
        query = select(Room).where(
            and_(
                or_(
                    Room.user_creator_id == user_id,
                    and_(
                        Room.invited_user_id == user_id,
                        Room.is_invited_accepted == True,
                    ),
                )
            )
        )
        result = await self.session.execute(query)
        room = result.scalar_one_or_none()
        if room:
            logger.debug(f"Active room found for user {user_id}: {room.room_id}")
        else:
            logger.debug(f"No active room for user {user_id}")
        return room

    async def is_user_in_any_room(self, user_id: int) -> bool:
        """Check if user is creator or invited (even if not accepted) in any room."""
        logger.debug(f"Checking if user {user_id} is in any room")
        query = select(Room).where(
            or_(
                Room.user_creator_id == user_id,
                Room.invited_user_id == user_id,
            )
        )
        result = await self.session.execute(query)
        room = result.scalar_one_or_none()
        in_room = room is not None
        logger.debug(f"User {user_id} in room: {in_room}")
        return in_room

    async def accept_invitation(self, room_id: UUID, user_id: int) -> Room | None:
        """Accept invitation - set is_invited_accepted to True."""
        logger.info(f"User {user_id} accepting invitation for room {room_id}")
        query = select(Room).where(
            and_(
                Room.room_id == room_id,
                Room.invited_user_id == user_id,
            )
        )
        result = await self.session.execute(query)
        room = result.scalar_one_or_none()
        if room is None:
            logger.warning(f"Room {room_id} not found for user {user_id}")
            return None
        room.is_invited_accepted = True
        await self.session.commit()
        await self.session.refresh(room)
        logger.info(f"Invitation accepted for room {room_id}")
        return room

    async def delete_room(self, room_id: UUID) -> bool:
        """Delete a room by ID."""
        logger.info(f"Deleting room: {room_id}")
        query = select(Room).where(Room.room_id == room_id)
        result = await self.session.execute(query)
        room = result.scalar_one_or_none()
        if room is None:
            logger.warning(f"Room {room_id} not found for deletion")
            return False
        await self.session.delete(room)
        await self.session.commit()
        logger.info(f"Room {room_id} deleted")
        return True

    async def get_creator_with_room(self, room_id: UUID) -> tuple[Room, User] | None:
        """Get room with creator user data."""
        logger.debug(f"Fetching room {room_id} with creator info")
        query = (
            select(Room, User)
            .join(User, Room.user_creator_id == User.id)
            .where(Room.room_id == room_id)
        )
        result = await self.session.execute(query)
        row = result.one_or_none()
        if row:
            logger.debug(f"Room {room_id} found with creator {row[1].fullname}")
            return row
        logger.debug(f"Room {room_id} not found with creator")
        return None