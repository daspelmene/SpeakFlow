from fastapi import APIRouter, HTTPException
from ml.model.matcher import SemanticMatcher
from pydantic import BaseModel, Field
from typing import List

router = APIRouter(prefix="/api/v1/match", tags=["Matching"])

try:
    matcher_service = SemanticMatcher()
except Exception as e:
    print(f"Error initializing ML engine: {e}")
    matcher_service = None

class UserProfile(BaseModel):
    id: int
    name: str
    native_language: str
    target_language: str
    target_level: str
    interests: List[str]
    bio: str

class MatchRequestPayload(BaseModel):
    target_user: UserProfile
    candidates: List[UserProfile] = Field(..., max_length=200)
    limit: int = Field(5, ge=1, le=50)


@router.post("/")
async def rank_matches(payload: MatchRequestPayload):
    if matcher_service is None:
        raise HTTPException(status_code=500, detail="ML engine is not initialized.")

    if not payload.candidates:
        return {"recommendation": None}

    # Считаем
    matches = matcher_service.rank_candidates(
        target_user=payload.target_user,
        candidates=payload.candidates,
        top_k=1
    )

    return {
        "recommendation": matches[0] if matches else None
    }