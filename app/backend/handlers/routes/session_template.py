import json
from fastapi import APIRouter, Depends, HTTPException

from schemas.session_template import (
    SessionTemplatesResponse,
    SessionTemplateGenerateRequest
)

from storage.database import Database

from services.llm.session_template_service import generate_both_templates

router = APIRouter(prefix="/session-templates", tags=["session-templates"])
    

@router.post("/generate", response_model=SessionTemplatesResponse)
async def generate_template(
    request: SessionTemplateGenerateRequest,
    db: Database = Depends(Database.get_db)
):
    user1 = await db.users.get_user_by_id(request.user1_id)
    user2 = await db.users.get_user_by_id(request.user2_id)
    if user1 is None or user2 is None:
        raise HTTPException(
            status_code=404,
            detail="One or both users were not found.",
        )

    common_interests = list(
        set(user1.interests or []) &
        set(user2.interests or [])
    )
    common_interests_text = (
        ", ".join(common_interests)
        if common_interests
        else "No common interests."
    )

    try:
        user1_template, user2_template = await generate_both_templates(
            user1,
            user2,
            common_interests_text
        )
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=500,
            detail="DeepSeek returned invalid JSON",
        )

    return {
        "user1_template": user1_template, # user1 - learner, user2 - helper
        "user2_template": user2_template # user2 - learner, user1 - helper
    }
