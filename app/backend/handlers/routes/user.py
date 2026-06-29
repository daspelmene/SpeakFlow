from fastapi import APIRouter, Depends, Query, status

from schemas.user import UpdateUserRequest, UserMeResponse, UserResponse
from storage.database import Database
from utils.jwt import get_current_user

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/match", response_model=list[UserResponse])
async def match_users(
        limit: int = Query(10, ge=1, le=100),
        current_user=Depends(get_current_user),
        db: Database = Depends(Database.get_db),
):
    matched = await db.users.get_matched_users(current_user)
    return matched[:limit]


@router.get("/me", response_model=UserMeResponse)
async def get_me(current_user=Depends(get_current_user)):
    return current_user


@router.patch("/me", response_model=UserMeResponse)
async def update_me(
    data: UpdateUserRequest,
    current_user=Depends(get_current_user),
    db: Database = Depends(Database.get_db),
):
    update_data = data.model_dump(exclude_none=True)
    if not update_data:
        return current_user
    user = await db.users.update_user(current_user.id, update_data)
    return user


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_me(
    current_user=Depends(get_current_user),
    db: Database = Depends(Database.get_db),
):
    await db.users.delete_user(current_user.id)
